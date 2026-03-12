from rest_framework import serializers
from .models import Incident
from accounts.models import Institution
from security.models import SecurityFacility
from utils.hashid_field import HashIdField


class IncidentSerializer(serializers.ModelSerializer):

    id = HashIdField(read_only=True)

    class Meta:
        model = Incident
        fields = "__all__"
        read_only_fields = ("follow_up_by", "follow_up_at")

    def validate(self, attrs):

        institution_hash = self.initial_data.get("institution")
        if institution_hash:
            try:
                attrs["institution"] = Institution.objects.get(id=institution_hash)
            except Institution.DoesNotExist:
                raise serializers.ValidationError({
                    "institution": "Invalid institution id"
                })

        facility_hash = self.initial_data.get("facility")

        if facility_hash not in [None, "", "null"]:
            try:
                attrs["facility"] = SecurityFacility.objects.get(id=facility_hash)
            except SecurityFacility.DoesNotExist:
                raise serializers.ValidationError({
                    "facility": "Invalid facility id"
                })

        return attrs
