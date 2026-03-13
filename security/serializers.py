from rest_framework import serializers
from utils.hashid_field import HashIdField
from .models import SecurityFacility


class SecurityFacilitySerializer(serializers.ModelSerializer):
    institution_id = HashIdField(required=False, allow_null=True)

    class Meta:
        model = SecurityFacility
        fields = [
            "id",
            "name",
            "institution_id",
            "facility_type",
            "county",
            "sub_county",
            "latitude",
            "longitude",
            "active",
        ]
