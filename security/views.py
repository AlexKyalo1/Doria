from django.utils import timezone
from rest_framework import generics, serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.access import facility_scope_for_user
from accounts.models import Institution
from billing.services.entitlements import BillingLimitError, assert_facility_limit_available
from .models import BlockedIP
from .models import SecurityFacility
from .serializers import BlockedIPSerializer, SecurityFacilitySerializer


class FacilityLimitValidationMixin:
    def _validate_institution_limit(self, institution_id, *, excluding_facility_id=None):
        if not institution_id:
            return
        institution = Institution.objects.filter(id=institution_id).first()
        if institution is None:
            raise serializers.ValidationError({"institution_id": "Institution not found."})
        try:
            assert_facility_limit_available(
                institution,
                excluding_facility_id=excluding_facility_id,
            )
        except BillingLimitError as exc:
            raise serializers.ValidationError({"institution_id": str(exc)})


class SecurityFacilityListCreateView(FacilityLimitValidationMixin, generics.ListCreateAPIView):
    serializer_class = SecurityFacilitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return facility_scope_for_user(self.request.user).order_by("name")

    def perform_create(self, serializer):
        self._validate_institution_limit(serializer.validated_data.get("institution_id"))
        serializer.save()


class SecurityFacilityDetailView(FacilityLimitValidationMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SecurityFacilitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return facility_scope_for_user(self.request.user)

    def perform_update(self, serializer):
        institution_id = serializer.validated_data.get("institution_id", serializer.instance.institution_id)
        self._validate_institution_limit(
            institution_id,
            excluding_facility_id=serializer.instance.id,
        )
        serializer.save()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def blocked_ip_list_api(request):
    if not getattr(request.user, "is_staff", False):
        return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)

    queryset = BlockedIP.objects.all().order_by("-active", "-blocked_at")
    status_filter = request.query_params.get("status", "active")
    if status_filter == "active":
        queryset = queryset.filter(active=True)
    elif status_filter == "inactive":
        queryset = queryset.filter(active=False)

    serializer = BlockedIPSerializer(queryset, many=True)
    return Response({"blocked_ips": serializer.data}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def blocked_ip_unblock_api(request, block_id):
    if not getattr(request.user, "is_staff", False):
        return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)

    try:
        blocked_ip = BlockedIP.objects.get(pk=block_id)
    except BlockedIP.DoesNotExist:
        return Response({"error": "Blocked IP not found"}, status=status.HTTP_404_NOT_FOUND)

    blocked_ip.active = False
    blocked_ip.expires_at = timezone.now()
    blocked_ip.save(update_fields=["active", "expires_at"])

    return Response({"blocked_ip": BlockedIPSerializer(blocked_ip).data}, status=status.HTTP_200_OK)
