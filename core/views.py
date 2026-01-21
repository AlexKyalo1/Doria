from django.shortcuts import render
from security.models import SecurityFacility
from incidents.models import Incident

def home(request):
    context = {
        "facility_count": SecurityFacility.objects.count(),
        "incident_count": Incident.objects.count(),
    }
    return render(request, "core/home.html", context)
