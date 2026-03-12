from django.http import JsonResponse
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response

from accounts.models import InstitutionMembership
from .models import Incident
from .serializers import IncidentSerializer


def _can_follow_up(user, incident):
    if user is None or not user.is_authenticated:
        return False
    if getattr(user, "is_staff", False):
        return True
    if incident.institution_id is None:
        return False
    if incident.institution.owner_id == user.id:
        return True
    return InstitutionMembership.objects.filter(
        institution_id=incident.institution_id,
        user_id=user.id,
    ).exists()


class IncidentListCreateView(generics.ListCreateAPIView):
    queryset = Incident.objects.all().order_by('-occurred_at')
    serializer_class = IncidentSerializer


class IncidentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Incident.objects.all()
    serializer_class = IncidentSerializer

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


def incident_map_data(request):
    qs = Incident.objects.all()
    institution_id = request.GET.get('institution_id')
    if institution_id:
        qs = qs.filter(institution_id=institution_id)

    data = list(
        qs.select_related("facility", "follow_up_by").values(
            'id',
            'ob_number',
            'incident_type',
            'description',
            'facility_id',
            'facility__name',
            'institution_id',
            'latitude',
            'longitude',
            'occurred_at',
            'follow_up_status',
            'follow_up_note',
            'follow_up_at',
            'follow_up_by__username',
        )
    )
    for item in data:
        item['facility_name'] = item.pop('facility__name')
        item['follow_up_by_name'] = item.pop('follow_up_by__username')
    return JsonResponse(data, safe=False)
