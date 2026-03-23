from datetime import timedelta

from django.db.models import Count
from django.db.models import Q
from django.conf import settings
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.access import facility_ids_for_user, institution_ids_for_user, is_site_admin
from accounts.models import FacilityMembership, Institution, InstitutionMembership
from billing.constants import FEATURE_MAX_AI_QUERIES_PER_MONTH
from billing.services.entitlements import (
    BillingLimitError,
    assert_ai_feature_enabled,
    assert_ai_usage_available,
    get_ai_usage_summary,
    increment_feature_usage,
)
from incidents.ai import IncidentInsightsError, generate_incident_insights
from security.models import SecurityFacility
from utils.hashid import decode_id
from .models import Incident
from .serializers import IncidentSerializer, IncidentUpdateCreateSerializer


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


def _date_range(start, end):
    days = (end - start).days
    return [start + timedelta(days=offset) for offset in range(days + 1)]


def _build_ai_analytics(queryset, *, date_from=None, date_to=None):
    today = timezone.now().date()
    if date_to is None:
        date_to = today
    if date_from is None:
        date_from = date_to - timedelta(days=30)

    current_start = date_from
    current_end = date_to
    period_days = max(1, (current_end - current_start).days + 1)
    prev_end = current_start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=period_days - 1)

    current_qs = queryset.filter(occurred_at__date__gte=current_start, occurred_at__date__lte=current_end)
    prev_qs = queryset.filter(occurred_at__date__gte=prev_start, occurred_at__date__lte=prev_end)

    current_total = current_qs.count()
    open_total = current_qs.filter(follow_up_status="open").count()
    resolved_total = current_qs.filter(follow_up_status="resolved").count()

    open_ages = []
    for item in current_qs.filter(follow_up_status="open").values("occurred_at", "reported_at"):
        occurred_at = item.get("occurred_at") or item.get("reported_at")
        if occurred_at:
            open_ages.append((today - occurred_at.date()).days)
    avg_open_age = round(sum(open_ages) / len(open_ages), 1) if open_ages else 0

    daily_counts_raw = current_qs.values("occurred_at__date").annotate(count=Count("id")).order_by("occurred_at__date")
    daily_map = {row["occurred_at__date"].isoformat(): row["count"] for row in daily_counts_raw if row["occurred_at__date"]}
    daily_counts = [
        {"date": day.isoformat(), "count": daily_map.get(day.isoformat(), 0)}
        for day in _date_range(current_start, current_end)
    ]

    current_types = {row["incident_type"] or "unknown": row["count"] for row in current_qs.values("incident_type").annotate(count=Count("id"))}
    prev_types = {row["incident_type"] or "unknown": row["count"] for row in prev_qs.values("incident_type").annotate(count=Count("id"))}

    type_trends = []
    for incident_type, count in sorted(current_types.items(), key=lambda item: item[1], reverse=True):
        prev_count = prev_types.get(incident_type, 0)
        delta = count - prev_count
        pct_change = round((delta / prev_count) * 100, 1) if prev_count else None
        type_trends.append({
            "incident_type": incident_type,
            "current_count": count,
            "previous_count": prev_count,
            "delta": delta,
            "pct_change": pct_change,
        })

    anomalies = []
    for item in type_trends:
        current_count = item["current_count"]
        previous_count = item["previous_count"]
        if previous_count == 0 and current_count >= 3:
            anomalies.append({**item, "reason": "new_spike"})
        elif previous_count > 0 and current_count >= max(3, previous_count * 2) and (current_count - previous_count) >= 3:
            anomalies.append({**item, "reason": "surge"})

    facility_rows = current_qs.values("facility_id", "facility__name", "follow_up_status", "occurred_at")
    facility_stats = {}
    for row in facility_rows:
        facility_id = row["facility_id"] or "unassigned"
        name = row.get("facility__name") or "Unassigned"
        stats = facility_stats.setdefault(
            facility_id,
            {"facility_id": facility_id, "facility_name": name, "total": 0, "open": 0, "resolved": 0, "open_ages": []},
        )
        stats["total"] += 1
        status = row.get("follow_up_status")
        if status == "open":
            stats["open"] += 1
            occurred_at = row.get("occurred_at")
            if occurred_at:
                stats["open_ages"].append((today - occurred_at.date()).days)
        elif status == "resolved":
            stats["resolved"] += 1

    facility_risk = []
    for stats in facility_stats.values():
        avg_age = round(sum(stats["open_ages"]) / len(stats["open_ages"]), 1) if stats["open_ages"] else 0
        facility_risk.append({
            "facility_id": stats["facility_id"],
            "facility_name": stats["facility_name"],
            "total_incidents": stats["total"],
            "open_followups": stats["open"],
            "resolved_followups": stats["resolved"],
            "avg_open_age_days": avg_age,
        })

    facility_risk.sort(key=lambda item: (item["open_followups"], item["total_incidents"]), reverse=True)

    return {
        "period": {
            "start": current_start.isoformat(),
            "end": current_end.isoformat(),
            "previous_start": prev_start.isoformat(),
            "previous_end": prev_end.isoformat(),
        },
        "kpis": {
            "total_incidents": current_total,
            "open_followups": open_total,
            "resolved_followups": resolved_total,
            "resolution_rate": round((resolved_total / current_total) * 100, 1) if current_total else 0,
            "avg_open_age_days": avg_open_age,
            "incidents_last_7_days": queryset.filter(occurred_at__date__gte=today - timedelta(days=6)).count(),
        },
        "trends": {
            "daily_counts": daily_counts,
            "type_trends": type_trends,
        },
        "anomalies": anomalies,
        "facility_risk": facility_risk,
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
        Q(facility_id__in=facility_ids)
        | Q(institution_id__in=institution_ids)
        | Q(facility__institution_id__in=institution_ids)
        | Q(facility__isnull=True, institution_id__in=institution_ids)
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
    institution = incident.institution
    if institution is None and incident.facility_id and incident.facility and incident.facility.institution_id:
        institution = incident.facility.institution
    if institution is None:
        return False
    if institution.owner_id == user.id:
        return True
    return InstitutionMembership.objects.filter(
        institution=institution,
        user_id=user.id,
    ).exists()


def _institutions_for_ai_request(queryset, *, institution_id=None, facility_id=None):
    institutions = []
    if institution_id:
        institution = Institution.objects.filter(id=institution_id).first()
        if institution:
            return [institution]
    if facility_id:
        facility = SecurityFacility.objects.select_related("institution").filter(id=facility_id).first()
        if facility and facility.institution_id:
            return [facility.institution]
        return []

    institution_ids = set(
        queryset.exclude(institution_id__isnull=True).values_list("institution_id", flat=True)
    )
    institution_ids.update(
        queryset.exclude(facility__institution_id__isnull=True).values_list("facility__institution_id", flat=True)
    )
    if not institution_ids:
        return []
    return list(Institution.objects.filter(id__in=institution_ids))


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

    def get_object(self):
        queryset = self.get_queryset()
        lookup = self.kwargs.get("pk")
        decoded_id = decode_id(lookup)
        if not decoded_id:
            from django.http import Http404
            raise Http404
        return queryset.get(id=decoded_id)

    def update(self, request, *args, **kwargs):
        incident = self.get_object()
        follow_up_requested = any(
            key in request.data for key in ("follow_up_note", "follow_up_status")
        )
        if follow_up_requested and not _can_follow_up(request.user, incident):
            return Response(
                {"error": "Only authorized facility or institution members can update follow-ups"},
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


class IncidentUpdateCreateView(generics.CreateAPIView):
    serializer_class = IncidentUpdateCreateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return _incident_scope_for_user(self.request.user).distinct()

    def get_object(self):
        queryset = self.get_queryset()
        lookup = self.kwargs.get("pk")
        decoded_id = decode_id(lookup)
        if not decoded_id:
            from django.http import Http404
            raise Http404
        return queryset.get(id=decoded_id)

    def create(self, request, *args, **kwargs):
        incident = self.get_object()
        if not _can_follow_up(request.user, incident):
            return Response(
                {"error": "Only authorized facility or institution members can update incidents"},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        update = serializer.save(incident=incident, created_by=request.user)

        incident.follow_up_status = update.status
        incident.follow_up_note = update.note
        incident.follow_up_by = request.user
        incident.follow_up_at = timezone.now()
        incident.save(update_fields=["follow_up_status", "follow_up_note", "follow_up_by", "follow_up_at"])

        return Response(IncidentSerializer(incident, context={"request": request}).data, status=status.HTTP_201_CREATED)


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
    institution_id = None
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

    date_from = None
    date_to = None
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

    target_institutions = _institutions_for_ai_request(
        queryset,
        institution_id=institution_id,
        facility_id=facility_id,
    )
    usage_summary = []
    for institution in target_institutions:
        try:
            assert_ai_feature_enabled(institution)
            usage = assert_ai_usage_available(institution)
            usage_summary.append(
                {
                    "institution_id": institution.id,
                    "institution_name": institution.name,
                    **usage,
                }
            )
        except BillingLimitError as exc:
            return Response(
                {"error": f"{institution.name}: {exc}"},
                status=status.HTTP_403_FORBIDDEN,
            )

    try:
        max_records = int(payload.get("max_records") or 50)
    except (TypeError, ValueError):
        return Response({"error": "max_records must be a number"}, status=status.HTTP_400_BAD_REQUEST)

    max_records = max(1, min(max_records, 100))
    incidents = list(queryset.order_by("-occurred_at")[:max_records])

    analytics = _build_ai_analytics(queryset, date_from=date_from, date_to=date_to)
    filters = {
        "institution_id": institution_hash or None,
        "facility_id": facility_id if facility_id else None,
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
                    "usage": usage_summary,
                },
                "analytics": analytics,
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

    updated_usage_summary = []
    for institution in target_institutions:
        increment_feature_usage(institution, FEATURE_MAX_AI_QUERIES_PER_MONTH)
        updated_usage_summary.append(
            {
                "institution_id": institution.id,
                "institution_name": institution.name,
                **get_ai_usage_summary(institution),
            }
        )

    return Response(
        {
            "insights": insights,
            "meta": {
                "incident_count": len(incidents),
                "filters": filters,
                "model": getattr(settings, "OPENAI_INCIDENT_INSIGHTS_MODEL", None),
                "usage": updated_usage_summary,
            },
            "analytics": analytics,
        },
        status=status.HTTP_200_OK,
    )






