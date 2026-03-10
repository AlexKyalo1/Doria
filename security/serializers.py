from rest_framework import serializers
from .models import SecurityFacility


class SecurityFacilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = SecurityFacility
        fields = '__all__'