from django.http import JsonResponse
from rest_framework import generics

from .models import Incident
from .serializers import IncidentSerializer


class IncidentListCreateView(generics.ListCreateAPIView):
    queryset = Incident.objects.all().order_by('-occurred_at')
    serializer_class = IncidentSerializer


class IncidentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Incident.objects.all()
    serializer_class = IncidentSerializer


def incident_map_data(request):
    qs = Incident.objects.all()
    institution_id = request.GET.get('institution_id')
    if institution_id:
        qs = qs.filter(institution_id=institution_id)

    data = list(
        qs.values(
            'id',
            'ob_number',
            'incident_type',
            'description',
            'facility_id',
            'institution_id',
            'latitude',
            'longitude',
            'occurred_at',
        )
    )
    return JsonResponse(data, safe=False)
