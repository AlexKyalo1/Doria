from rest_framework import serializers
from .models import (
    Incident,
    IncidentActivity,
    IncidentComment,
    IncidentInstitutionAccess,
    IncidentUpdate,
)
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


class IncidentInstitutionAccessSerializer(serializers.ModelSerializer):
    id = HashIdField(read_only=True)
    institution_id = HashIdField(read_only=True)
    institution_name = serializers.ReadOnlyField(source="institution.name")
    shared_by_name = serializers.SerializerMethodField()

    class Meta:
        model = IncidentInstitutionAccess
        fields = (
            "id",
            "institution_id",
            "institution_name",
            "access_level",
            "shared_by_name",
            "created_at",
        )

    def get_shared_by_name(self, obj):
        user = obj.shared_by
        if not user:
            return "Unknown user"
        full_name = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
        return full_name or getattr(user, "username", "Unknown user")


class IncidentCommentSerializer(serializers.ModelSerializer):
    id = HashIdField(read_only=True)
    created_by_name = serializers.SerializerMethodField()
    actor_institution_name = serializers.ReadOnlyField(source="actor_institution.name")
    actor_facility_name = serializers.ReadOnlyField(source="actor_facility.name")

    class Meta:
        model = IncidentComment
        fields = (
            "id",
            "body",
            "created_at",
            "created_by_name",
            "actor_institution_name",
            "actor_facility_name",
        )

    def get_created_by_name(self, obj):
        user = obj.created_by
        if not user:
            return "Unknown user"
        full_name = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
        return full_name or getattr(user, "username", "Unknown user")


class IncidentActivitySerializer(serializers.ModelSerializer):
    id = HashIdField(read_only=True)
    actor_name = serializers.SerializerMethodField()
    actor_institution_name = serializers.ReadOnlyField(source="actor_institution.name")
    actor_facility_name = serializers.ReadOnlyField(source="actor_facility.name")

    class Meta:
        model = IncidentActivity
        fields = (
            "id",
            "action_type",
            "summary",
            "metadata",
            "created_at",
            "actor_name",
            "actor_institution_name",
            "actor_facility_name",
        )

    def get_actor_name(self, obj):
        user = obj.actor
        if not user:
            return "Unknown user"
        full_name = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
        return full_name or getattr(user, "username", "Unknown user")


class IncidentSerializer(serializers.ModelSerializer):
    id = HashIdField(read_only=True)
    institution_hash = HashIdField(source="institution_id", read_only=True)
    updates = IncidentUpdateSerializer(many=True, read_only=True)
    collaboration = IncidentInstitutionAccessSerializer(many=True, source="institution_access", read_only=True)
    comments = IncidentCommentSerializer(many=True, read_only=True)
    activity = IncidentActivitySerializer(many=True, read_only=True)
    follow_up_by_name = serializers.SerializerMethodField()
    institution_name = serializers.SerializerMethodField()

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

    def get_institution_name(self, obj):
        if obj.institution_id and obj.institution:
            return obj.institution.name
        if obj.facility_id and obj.facility and obj.facility.institution_id:
            return obj.facility.institution.name
        return ""


class IncidentUpdateCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncidentUpdate
        fields = ("status", "note", "action_taken", "assigned_to_name", "next_step", "due_at")


class IncidentInstitutionAccessCreateSerializer(serializers.Serializer):
    institution_id = HashIdField()
    access_level = serializers.ChoiceField(
        choices=IncidentInstitutionAccess.ACCESS_LEVEL_CHOICES,
        required=False,
        default=IncidentInstitutionAccess.ACCESS_CONTRIBUTOR,
    )


class IncidentCommentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncidentComment
        fields = ("body",)


class PublicIncidentReportSerializer(serializers.Serializer):
    reporter_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    reporter_contact = serializers.CharField(max_length=255, required=False, allow_blank=True)
    incident_type = serializers.ChoiceField(choices=Incident.INCIDENT_TYPES, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    public_location_hint = serializers.CharField(max_length=255, required=False, allow_blank=True)
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)
    occurred_at = serializers.DateTimeField()
    image = serializers.FileField(required=False, allow_null=True)

    def validate(self, attrs):
        description = (attrs.get("description") or "").strip()
        image = attrs.get("image")
        location_hint = (attrs.get("public_location_hint") or "").strip()
        latitude = attrs.get("latitude")
        longitude = attrs.get("longitude")

        if not description and not image:
            raise serializers.ValidationError({"description": "Provide incident details or upload an image."})

        if (latitude is None) ^ (longitude is None):
            raise serializers.ValidationError({"latitude": "Latitude and longitude must be provided together."})

        if not location_hint and (latitude is None or longitude is None):
            raise serializers.ValidationError(
                {"public_location_hint": "Provide a location hint or coordinates so the system can match a facility."}
            )

        if image is not None and not getattr(image, "content_type", "").startswith("image/"):
            raise serializers.ValidationError({"image": "Uploaded file must be an image."})

        return attrs


class PublicIncidentInquirySerializer(serializers.Serializer):
    reference = serializers.CharField(max_length=50)
    reporter_contact = serializers.CharField(max_length=255)
