from django.shortcuts import render
from rest_framework import generics
from .models import SecurityFacility
from .serializers import SecurityFacilitySerializer

# Create your views here.

class SecurityFacilityListCreateView(generics.ListCreateAPIView):
    queryset = SecurityFacility.objects.all()
    serializer_class = SecurityFacilitySerializer

class SecurityFacilityDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = SecurityFacility.objects.all()
    serializer_class = SecurityFacilitySerializer

