from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from accounts.access import facility_scope_for_user
from .models import SecurityFacility
from .serializers import SecurityFacilitySerializer


class SecurityFacilityListCreateView(generics.ListCreateAPIView):
    serializer_class = SecurityFacilitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return facility_scope_for_user(self.request.user).order_by("name")


class SecurityFacilityDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SecurityFacilitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return facility_scope_for_user(self.request.user)
