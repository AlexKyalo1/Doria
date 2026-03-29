from django.utils import timezone
from rest_framework import serializers

from accounts.models import Institution
from incidents.models import Incident
from incidents.serializers import IncidentSerializer
from security.models import SecurityFacility
from utils.hashid import decode_id, encode_id
from utils.hashid_field import HashIdField

from .models import ChatActionLog, ChatConversation, ChatMessage, EmergencyAlert, InstitutionChatWorkspace


def resolve_facility_id(value):
    if value in (None, "", "null"):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    if isinstance(value, str):
        return decode_id(value)
    return None


class ChatMessageSerializer(serializers.ModelSerializer):
    id = HashIdField(read_only=True)
    sender_user_name = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = ("id", "sender_type", "body", "metadata", "sender_user", "sender_user_name", "created_at")
        read_only_fields = ("sender_user", "sender_type", "sender_user_name", "created_at", "metadata")

    def get_sender_user_name(self, obj):
        user = obj.sender_user
        if not user:
            return ""
        full_name = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
        return full_name or getattr(user, "username", "")


class ChatActionLogSerializer(serializers.ModelSerializer):
    id = HashIdField(read_only=True)
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = ChatActionLog
        fields = ("id", "action_type", "status", "metadata", "created_at", "actor_name")
        read_only_fields = fields

    def get_actor_name(self, obj):
        if not obj.actor:
            return ""
        full_name = f"{getattr(obj.actor, 'first_name', '')} {getattr(obj.actor, 'last_name', '')}".strip()
        return full_name or getattr(obj.actor, "username", "")


class ChatConversationSerializer(serializers.ModelSerializer):
    id = HashIdField(read_only=True)
    institution_id = serializers.SerializerMethodField()
    facility_id = HashIdField(required=False, allow_null=True)
    incident_id = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    assigned_agent_name = serializers.SerializerMethodField()
    messages = ChatMessageSerializer(many=True, read_only=True)
    action_logs = ChatActionLogSerializer(many=True, read_only=True)

    class Meta:
        model = ChatConversation
        fields = (
            "id",
            "institution_id",
            "facility_id",
            "incident_id",
            "status",
            "source",
            "subject",
            "customer_name",
            "customer_contact",
            "created_by",
            "created_by_name",
            "assigned_agent",
            "assigned_agent_name",
            "created_at",
            "updated_at",
            "messages",
            "action_logs",
        )
        read_only_fields = (
            "created_by",
            "created_by_name",
            "assigned_agent_name",
            "created_at",
            "updated_at",
            "messages",
            "action_logs",
            "incident_id",
            "institution_id",
        )

    def get_institution_id(self, obj):
        return encode_id(obj.workspace.institution_id)

    def get_incident_id(self, obj):
        if not obj.incident_id:
            return None
        return encode_id(obj.incident_id)

    def get_created_by_name(self, obj):
        user = obj.created_by
        if not user:
            return ""
        full_name = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
        return full_name or getattr(user, "username", "")

    def get_assigned_agent_name(self, obj):
        user = obj.assigned_agent
        if not user:
            return ""
        full_name = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
        return full_name or getattr(user, "username", "")


class ChatConversationCreateSerializer(serializers.ModelSerializer):
    institution_id = HashIdField(write_only=True)
    facility_id = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)
    initial_message = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = ChatConversation
        fields = (
            "institution_id",
            "facility_id",
            "status",
            "source",
            "subject",
            "customer_name",
            "customer_contact",
            "assigned_agent",
            "initial_message",
        )

    def validate(self, attrs):
        institution_id = attrs.pop("institution_id")
        institution = Institution.objects.filter(id=institution_id).first()
        if institution is None:
            raise serializers.ValidationError({"institution_id": "Institution not found."})

        raw_facility_id = attrs.pop("facility_id", None)
        facility_id = resolve_facility_id(raw_facility_id)
        facility = None
        if raw_facility_id not in (None, "", "null") and facility_id is None:
            raise serializers.ValidationError({"facility_id": "Facility not found."})
        if facility_id is not None:
            facility = SecurityFacility.objects.filter(id=facility_id).first()
            if facility is None:
                raise serializers.ValidationError({"facility_id": "Facility not found."})
            if facility.institution_id != institution.id:
                raise serializers.ValidationError({"facility_id": "Facility must belong to the selected institution."})

        attrs["institution"] = institution
        attrs["facility"] = facility
        return attrs

    def create(self, validated_data):
        institution = validated_data.pop("institution")
        initial_message = validated_data.pop("initial_message", "").strip()
        facility = validated_data.pop("facility", None)
        workspace, _ = InstitutionChatWorkspace.objects.get_or_create(institution=institution)

        conversation = ChatConversation.objects.create(
            workspace=workspace,
            facility=facility,
            created_by=self.context["request"].user,
            **validated_data,
        )

        if initial_message:
            ChatMessage.objects.create(
                conversation=conversation,
                sender_user=self.context["request"].user,
                sender_type=ChatMessage.SENDER_AGENT,
                body=initial_message,
            )

        return conversation


class ChatMessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ("body",)

    def create(self, validated_data):
        conversation = self.context["conversation"]
        user = self.context["request"].user
        message = ChatMessage.objects.create(
            conversation=conversation,
            sender_user=user,
            sender_type=ChatMessage.SENDER_AGENT,
            **validated_data,
        )
        ChatConversation.objects.filter(pk=conversation.pk).update(updated_at=timezone.now())
        conversation.refresh_from_db()
        return message


class ChatConversationIncidentCreateSerializer(serializers.Serializer):
    incident_type = serializers.ChoiceField(choices=Incident.INCIDENT_TYPES)
    ob_number = serializers.CharField(max_length=50)
    description = serializers.CharField()
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    occurred_at = serializers.DateTimeField(required=False)
    facility_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate(self, attrs):
        conversation = self.context["conversation"]
        raw_facility_id = attrs.pop("facility_id", None)
        facility_id = resolve_facility_id(raw_facility_id)
        facility = conversation.facility

        if raw_facility_id not in (None, "", "null") and facility_id is None:
            raise serializers.ValidationError({"facility_id": "Facility not found."})
        if facility_id is not None:
            facility = SecurityFacility.objects.filter(id=facility_id).first()
            if facility is None:
                raise serializers.ValidationError({"facility_id": "Facility not found."})

        if facility and facility.institution_id != conversation.workspace.institution_id:
            raise serializers.ValidationError({"facility_id": "Facility must belong to the conversation institution."})

        attrs["facility"] = facility
        return attrs

    def create(self, validated_data):
        conversation = self.context["conversation"]
        request = self.context["request"]
        occurred_at = validated_data.pop("occurred_at", timezone.now())
        facility = validated_data.pop("facility", conversation.facility)

        incident_payload = {
            "facility": facility.id if facility else None,
            "institution": conversation.workspace.institution_id,
            "occurred_at": occurred_at.isoformat(),
            "contact_phone": conversation.customer_contact,
            **validated_data,
        }
        incident_serializer = IncidentSerializer(data=incident_payload, context={"request": request})
        incident_serializer.is_valid(raise_exception=True)
        incident = incident_serializer.save()

        conversation.incident = incident
        if facility and conversation.facility_id != facility.id:
            conversation.facility = facility
        conversation.status = ChatConversation.STATUS_PENDING
        conversation.save(update_fields=["incident", "facility", "status", "updated_at"])

        ChatActionLog.objects.create(
            conversation=conversation,
            actor=request.user,
            action_type=ChatActionLog.ACTION_CREATE_INCIDENT,
            status=ChatActionLog.STATUS_COMPLETED,
            metadata={"incident_id": encode_id(incident.id)},
        )
        ChatMessage.objects.create(
            conversation=conversation,
            sender_user=request.user,
            sender_type=ChatMessage.SENDER_SYSTEM,
            body=f"Incident {incident.ob_number} created from this chat.",
        )
        ChatConversation.objects.filter(pk=conversation.pk).update(updated_at=timezone.now())
        conversation.refresh_from_db()
        return incident


class EmergencyAlertSerializer(serializers.ModelSerializer):
    id = HashIdField(read_only=True)
    institution_id = serializers.SerializerMethodField()
    institution_name = serializers.ReadOnlyField(source="workspace.institution.name")
    facility_id = HashIdField(read_only=True)
    facility_name = serializers.ReadOnlyField(source="facility.name")
    incident_id = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    assigned_operator_name = serializers.SerializerMethodField()

    class Meta:
        model = EmergencyAlert
        fields = (
            "id",
            "institution_id",
            "institution_name",
            "facility_id",
            "facility_name",
            "incident_id",
            "incident_type",
            "summary",
            "location_label",
            "latitude",
            "longitude",
            "status",
            "operator_notes",
            "created_by",
            "created_by_name",
            "assigned_operator",
            "assigned_operator_name",
            "created_at",
            "updated_at",
            "acknowledged_at",
            "resolved_at",
        )
        read_only_fields = (
            "institution_id",
            "institution_name",
            "facility_id",
            "facility_name",
            "incident_id",
            "created_by",
            "created_by_name",
            "assigned_operator",
            "assigned_operator_name",
            "created_at",
            "updated_at",
            "acknowledged_at",
            "resolved_at",
        )

    def get_institution_id(self, obj):
        return encode_id(obj.workspace.institution_id)

    def get_incident_id(self, obj):
        if not obj.incident_id:
            return None
        return encode_id(obj.incident_id)

    def get_created_by_name(self, obj):
        user = obj.created_by
        if not user:
            return ""
        full_name = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
        return full_name or getattr(user, "username", "")

    def get_assigned_operator_name(self, obj):
        user = obj.assigned_operator
        if not user:
            return ""
        full_name = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
        return full_name or getattr(user, "username", "")


class EmergencyAlertCreateSerializer(serializers.ModelSerializer):
    institution_id = HashIdField(write_only=True)
    facility_id = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)
    incident_id = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = EmergencyAlert
        fields = (
            "institution_id",
            "facility_id",
            "incident_id",
            "incident_type",
            "summary",
            "location_label",
            "latitude",
            "longitude",
        )

    def validate(self, attrs):
        institution_id = attrs.pop("institution_id")
        institution = Institution.objects.filter(id=institution_id).first()
        if institution is None:
            raise serializers.ValidationError({"institution_id": "Institution not found."})

        raw_facility_id = attrs.pop("facility_id", None)
        raw_incident_id = attrs.pop("incident_id", None)

        facility_id = resolve_facility_id(raw_facility_id)
        facility = None
        if raw_facility_id not in (None, "", "null") and facility_id is None:
            raise serializers.ValidationError({"facility_id": "Facility not found."})
        if facility_id is not None:
            facility = SecurityFacility.objects.filter(id=facility_id).first()
            if facility is None:
                raise serializers.ValidationError({"facility_id": "Facility not found."})
            if facility.institution_id != institution.id:
                raise serializers.ValidationError({"facility_id": "Facility must belong to the selected institution."})

        incident = None
        if raw_incident_id not in (None, "", "null"):
            incident_pk = decode_id(raw_incident_id) if isinstance(raw_incident_id, str) else raw_incident_id
            if not incident_pk:
                raise serializers.ValidationError({"incident_id": "Incident not found."})
            incident = Incident.objects.select_related("facility", "institution").filter(id=incident_pk).first()
            if incident is None:
                raise serializers.ValidationError({"incident_id": "Incident not found."})
            incident_institution_id = incident.institution_id or getattr(incident.facility, "institution_id", None)
            if incident_institution_id != institution.id:
                raise serializers.ValidationError({"incident_id": "Incident must belong to the selected institution."})
            if facility is None and incident.facility_id:
                facility = incident.facility

        attrs["institution"] = institution
        attrs["facility"] = facility
        attrs["incident"] = incident
        return attrs

    def create(self, validated_data):
        institution = validated_data.pop("institution")
        facility = validated_data.pop("facility", None)
        incident = validated_data.pop("incident", None)
        workspace, _ = InstitutionChatWorkspace.objects.get_or_create(institution=institution)
        return EmergencyAlert.objects.create(
            workspace=workspace,
            facility=facility,
            incident=incident,
            created_by=self.context["request"].user,
            **validated_data,
        )


class EmergencyAlertUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyAlert
        fields = ("status", "operator_notes")

    def update(self, instance, validated_data):
        next_status = validated_data.get("status", instance.status)
        operator_notes = validated_data.get("operator_notes")
        instance.status = next_status
        if operator_notes is not None:
            instance.operator_notes = operator_notes

        user = self.context["request"].user
        if instance.assigned_operator_id is None:
            instance.assigned_operator = user

        now = timezone.now()
        if next_status in {EmergencyAlert.STATUS_ACKNOWLEDGED, EmergencyAlert.STATUS_DISPATCHED} and instance.acknowledged_at is None:
            instance.acknowledged_at = now
        if next_status == EmergencyAlert.STATUS_RESOLVED:
            if instance.acknowledged_at is None:
                instance.acknowledged_at = now
            instance.resolved_at = now
        elif next_status != EmergencyAlert.STATUS_RESOLVED:
            instance.resolved_at = None

        instance.save()
        return instance
