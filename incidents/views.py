from django.shortcuts import render

# incidents/views.py
from django.http import JsonResponse
from .models import Incident

def incident_map_data(request):
    data = list(Incident.objects.values(
        'incident_type', 'latitude', 'longitude', 'occurred_at'
    ))
    return JsonResponse(data, safe=False)
