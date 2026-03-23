from rest_framework import serializers
from .models import Incident, IncidentUpdate
from accounts.models import Institution
from security.models import SecurityFacility
from utils.hashid_field import HashIdField


class IncidentUpdateSerializer(serializers.ModelSerializer):
    id = HashIdField(read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = IncidentUpdate
        fields = (
            "id",
            "status",
            "note",
            "action_taken",
            "assigned_to_name",
            "next_step",
            "due_at",
            "created_at",
            "created_by",
            "created_by_name",
        )
        read_only_fields = ("created_by", "created_at", "created_by_name")

    def get_created_by_name(self, obj):
        user = obj.created_by
        if not user:
            return "Unknown user"
        full_name = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
        return full_name or getattr(user, "username", "Unknown user")


class IncidentSerializer(serializers.ModelSerializer):
    id = HashIdField(read_only=True)
    updates = IncidentUpdateSerializer(many=True, read_only=True)
    follow_up_by_name = serializers.SerializerMethodField()

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

        facility = attrs.get("facility") or getattr(self.instance, "facility", None)
        if facility and facility.institution_id:
            attrs["institution"] = facility.institution
        elif "institution" not in attrs and self.instance is not None:
            attrs["institution"] = self.instance.institution

        return attrs

    def get_follow_up_by_name(self, obj):
        user = obj.follow_up_by
        if not user:
            return ""
        full_name = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
        return full_name or getattr(user, "username", "")


class IncidentUpdateCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncidentUpdate
        fields = ("status", "note", "action_taken", "assigned_to_name", "next_step", "due_at")
