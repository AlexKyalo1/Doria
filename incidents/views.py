from django.http import JsonResponse
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.access import facility_ids_for_user, institution_ids_for_user, is_site_admin
from accounts.models import FacilityMembership, InstitutionMembership
from .models import Incident
from .serializers import IncidentSerializer



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
