from django.conf import settings
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.access import facility_ids_for_user, institution_ids_for_user, is_site_admin
from accounts.models import FacilityMembership, InstitutionMembership
from incidents.ai import IncidentInsightsError, generate_incident_insights
from utils.hashid import decode_id
from .models import Incident
from .serializers import IncidentSerializer


INCIDENT_ANALYTICS_FALLBACK = {
    "summary": "No incidents matched the selected filters.",
    "risk_level": "low",
    "top_patterns": [],
    "priority_actions": [],
    "follow_up_gaps": [],
    "incident_breakdown": [],
    "facility_hotspots": [],
    "recommended_queries": [],
}


def _incident_scope_for_user(user):
    qs = Incident.objects.all()
    if user is None or not user.is_authenticated:
        return qs.none()
    if is_site_admin(user):
        return qs

    facility_ids = facility_ids_for_user(user)
    institution_ids = institution_ids_for_user(user)

    if not facility_ids and not institution_ids:
        return qs.none()

    return qs.filter(
        facility_id__in=facility_ids,
    ) | qs.filter(
        institution_id__in=institution_ids,
    ) | qs.filter(
        facility__isnull=True,
        institution_id__in=institution_ids,
    )


def _can_follow_up(user, incident):
    if user is None or not user.is_authenticated:
        return False
    if getattr(user, "is_staff", False):
        return True
    if incident.facility_id and FacilityMembership.objects.filter(
        facility_id=incident.facility_id,
        user_id=user.id,
    ).exists():
        return True
    if incident.institution_id is None:
        return False
    if incident.institution.owner_id == user.id:
        return True
    return InstitutionMembership.objects.filter(
        institution_id=incident.institution_id,
        user_id=user.id,
        role="admin",
    ).exists()


class IncidentListCreateView(generics.ListCreateAPIView):
    serializer_class = IncidentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return _incident_scope_for_user(self.request.user).order_by("-occurred_at").distinct()


class IncidentDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = IncidentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return _incident_scope_for_user(self.request.user).distinct()

    def update(self, request, *args, **kwargs):
        incident = self.get_object()
        follow_up_requested = any(
            key in request.data for key in ("follow_up_note", "follow_up_status")
        )
        if follow_up_requested and not _can_follow_up(request.user, incident):
            return Response(
                {"error": "Only facility members/admins can update follow-ups"},
                status=status.HTTP_403_FORBIDDEN,
            )

        partial = kwargs.pop("partial", False)
        serializer = self.get_serializer(incident, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        if follow_up_requested:
            serializer.save(follow_up_by=request.user, follow_up_at=timezone.now())
        else:
            serializer.save()

        return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def incident_map_data(request):
    qs = _incident_scope_for_user(request.user).distinct()
    institution_id = request.GET.get("institution_id")
    if institution_id:
        qs = qs.filter(institution_id=institution_id)

    data = list(
        qs.select_related("facility", "follow_up_by").values(
            "id",
            "ob_number",
            "incident_type",
            "description",
            "facility_id",
            "facility__name",
            "institution_id",
            "latitude",
            "longitude",
            "occurred_at",
            "follow_up_status",
            "follow_up_note",
            "follow_up_at",
            "follow_up_by__username",
        )
    )
    for item in data:
        item["facility_name"] = item.pop("facility__name")
        item["follow_up_by_name"] = item.pop("follow_up_by__username")
    return JsonResponse(data, safe=False)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def incident_ai_insights_api(request):
    payload = request.data or {}
    queryset = _incident_scope_for_user(request.user).select_related("facility", "institution").distinct()

    institution_hash = payload.get("institution_id")
    if institution_hash:
        institution_id = decode_id(institution_hash)
        if not institution_id:
            return Response({"error": "Invalid institution id"}, status=status.HTTP_400_BAD_REQUEST)
        queryset = queryset.filter(institution_id=institution_id)
    facility_id = payload.get("facility_id")
    if facility_id:
        try:
            facility_id = int(facility_id)
        except (TypeError, ValueError):
            return Response({"error": "Invalid facility id"}, status=status.HTTP_400_BAD_REQUEST)
        queryset = queryset.filter(facility_id=facility_id)

    incident_type = (payload.get("incident_type") or "").strip()
    if incident_type:
        queryset = queryset.filter(incident_type=incident_type)

    date_from_raw = payload.get("date_from")
    if date_from_raw:
        date_from = parse_date(date_from_raw)
        if not date_from:
            return Response({"error": "Invalid date_from"}, status=status.HTTP_400_BAD_REQUEST)
        queryset = queryset.filter(occurred_at__date__gte=date_from)

    date_to_raw = payload.get("date_to")
    if date_to_raw:
        date_to = parse_date(date_to_raw)
        if not date_to:
            return Response({"error": "Invalid date_to"}, status=status.HTTP_400_BAD_REQUEST)
        queryset = queryset.filter(occurred_at__date__lte=date_to)

    try:
        max_records = int(payload.get("max_records") or 50)
    except (TypeError, ValueError):
        return Response({"error": "max_records must be a number"}, status=status.HTTP_400_BAD_REQUEST)

    max_records = max(1, min(max_records, 100))
    incidents = list(queryset.order_by("-occurred_at")[:max_records])

    filters = {
        "institution_id": institution_hash or None,        "facility_id": facility_id if facility_id else None,
        "incident_type": incident_type or None,
        "date_from": date_from_raw or None,
        "date_to": date_to_raw or None,
        "max_records": max_records,
    }

    if not incidents:
        return Response(
            {
                "insights": INCIDENT_ANALYTICS_FALLBACK,
                "meta": {
                    "incident_count": 0,
                    "filters": filters,
                    "model": None,
                },
            },
            status=status.HTTP_200_OK,
        )

    actor_label = request.user.username or f"user-{request.user.id}"
    try:
        insights = generate_incident_insights(
            incidents=incidents,
            filters=filters,
            actor_label=actor_label,
        )
    except IncidentInsightsError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    return Response(
        {
            "insights": insights,
            "meta": {
                "incident_count": len(incidents),
                "filters": filters,
                "model": getattr(settings, "OPENAI_INCIDENT_INSIGHTS_MODEL", None),
            },
        },
        status=status.HTTP_200_OK,
    )


