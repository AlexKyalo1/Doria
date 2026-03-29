from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.access import facility_ids_for_user, institution_ids_for_user, is_site_admin
from accounts.models import FacilityMembership, InstitutionMembership
from billing.constants import FEATURE_MAX_CHAT_CONVERSATIONS_PER_MONTH
from billing.services.entitlements import (
    BillingLimitError,
    assert_chat_feature_enabled,
    assert_chat_usage_available,
    get_chat_usage_summary,
    increment_feature_usage,
)
from utils.hashid import decode_id, encode_id

from .admin_actions import AdminActionError, execute_admin_action
from .admin_ai import (
    AdminAssistantError,
    generate_admin_assistant_plan,
    generate_call_center_reply,
    generate_call_center_suggestions,
)
from .models import ChatConversation, EmergencyAlert
from .serializers import (
    ChatConversationCreateSerializer,
    ChatConversationIncidentCreateSerializer,
    ChatConversationSerializer,
    ChatMessageCreateSerializer,
    ChatMessageSerializer,
    EmergencyAlertCreateSerializer,
    EmergencyAlertSerializer,
    EmergencyAlertUpdateSerializer,
)


def _conversation_scope_for_user(user):
    queryset = ChatConversation.objects.select_related(
        "workspace__institution",
        "facility",
        "incident",
        "created_by",
        "assigned_agent",
    ).prefetch_related("messages", "action_logs")
    if user is None or not user.is_authenticated:
        return queryset.none()
    if is_site_admin(user):
        return queryset

    facility_ids = facility_ids_for_user(user)
    institution_ids = institution_ids_for_user(user)

    if not facility_ids and not institution_ids:
        return queryset.none()

    return queryset.filter(
        Q(workspace__institution_id__in=institution_ids)
        | Q(facility_id__in=facility_ids)
    ).distinct()


def _can_manage_institution(user, institution_id):
    if user is None or not user.is_authenticated:
        return False
    if is_site_admin(user):
        return True
    if institution_id in institution_ids_for_user(user):
        return True
    return FacilityMembership.objects.filter(
        user_id=user.id,
        facility__institution_id=institution_id,
    ).exists()


def _can_create_incident_from_conversation(user, conversation):
    if user is None or not user.is_authenticated:
        return False
    if is_site_admin(user):
        return True
    institution = conversation.workspace.institution
    if institution.owner_id == user.id:
        return True
    if InstitutionMembership.objects.filter(
        institution=institution,
        user_id=user.id,
        role="admin",
    ).exists():
        return True
    if conversation.facility_id and FacilityMembership.objects.filter(
        facility_id=conversation.facility_id,
        user_id=user.id,
    ).exists():
        return True
    return False


def _emergency_alert_scope_for_user(user):
    queryset = EmergencyAlert.objects.select_related(
        "workspace__institution",
        "facility",
        "incident",
        "created_by",
        "assigned_operator",
    )
    if user is None or not user.is_authenticated:
        return queryset.none()
    if is_site_admin(user):
        return queryset

    facility_ids = facility_ids_for_user(user)
    institution_ids = institution_ids_for_user(user)

    if not facility_ids and not institution_ids:
        return queryset.none()

    return queryset.filter(
        Q(workspace__institution_id__in=institution_ids)
        | Q(facility_id__in=facility_ids)
    ).distinct()


def _admin_assistant_buttons(*, prompt, actions, requires_clarification):
    prompt_text = (prompt or "").lower()
    buttons = []
    seen_paths = set()

    def add_button(label, path, note):
        if path in seen_paths:
            return
        seen_paths.add(path)
        buttons.append({"label": label, "path": path, "note": note})

    action_type_to_button = {
        "list_users": ("Open admin users", "/admin/users", "Review users, roles, and account access."),
        "update_user_access": ("Manage user access", "/admin/users", "Open the user admin screen to verify or adjust access."),
        "list_institutions": ("Open institutions", "/institutions", "Review institutions and their members."),
        "create_institution": ("Open institutions", "/institutions", "Go to institutions to review or continue institution setup."),
        "create_facility": ("Open facilities", "/facilities", "Open facilities to review or add location details."),
        "add_institution_member": ("Open institutions", "/institutions", "Review institution membership and assignments."),
        "unblock_ip": ("Open security control", "/admin/security", "Review blocked IPs and security controls."),
    }

    for action in actions or []:
        action_type = action.get("action_type")
        button = action_type_to_button.get(action_type)
        if button:
            add_button(*button)

    if "create user" in prompt_text or ("user" in prompt_text and "create" in prompt_text):
        add_button("Open admin users", "/admin/users", "Create or manage platform users quickly.")
    if "institution" in prompt_text:
        add_button("Open institutions", "/institutions", "Open institutions to review the current records.")
    if "facility" in prompt_text or "station" in prompt_text or "post" in prompt_text:
        add_button("Open facilities", "/facilities", "Open facilities to add or review locations.")
    if "block" in prompt_text or "ip" in prompt_text or "security" in prompt_text:
        add_button("Open security control", "/admin/security", "Review blocked IPs and related security actions.")

    if requires_clarification and not buttons:
        add_button("Open admin users", "/admin/users", "Open the closest admin screen while you gather the missing detail.")

    return buttons[:4]


class ChatConversationListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = _conversation_scope_for_user(self.request.user)
        institution_hash = self.request.query_params.get("institution_id")
        if institution_hash:
            institution_id = decode_id(institution_hash)
            if institution_id:
                queryset = queryset.filter(workspace__institution_id=institution_id)
            else:
                queryset = queryset.none()

        status_value = (self.request.query_params.get("status") or "").strip()
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ChatConversationCreateSerializer
        return ChatConversationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        institution = serializer.validated_data["institution"]

        if not _can_manage_institution(request.user, institution.id):
            return Response(
                {"error": "You do not have access to this institution chat workspace."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            assert_chat_feature_enabled(institution)
            usage = assert_chat_usage_available(institution)
        except BillingLimitError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)

        conversation = serializer.save()
        increment_feature_usage(institution, FEATURE_MAX_CHAT_CONVERSATIONS_PER_MONTH)

        payload = ChatConversationSerializer(conversation, context={"request": request}).data
        return Response(
            {
                "conversation": payload,
                "usage": get_chat_usage_summary(institution),
                "previous_usage": usage,
            },
            status=status.HTTP_201_CREATED,
        )


class ChatConversationDetailView(generics.RetrieveAPIView):
    serializer_class = ChatConversationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return _conversation_scope_for_user(self.request.user)

    def get_object(self):
        lookup = self.kwargs.get("pk")
        decoded_id = decode_id(lookup)
        if not decoded_id:
            from django.http import Http404

            raise Http404
        return self.get_queryset().get(id=decoded_id)


class ChatMessageCreateView(generics.CreateAPIView):
    serializer_class = ChatMessageCreateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return _conversation_scope_for_user(self.request.user)

    def get_object(self):
        lookup = self.kwargs.get("pk")
        decoded_id = decode_id(lookup)
        if not decoded_id:
            from django.http import Http404

            raise Http404
        return self.get_queryset().get(id=decoded_id)

    def create(self, request, *args, **kwargs):
        conversation = self.get_object()
        serializer = self.get_serializer(
            data=request.data,
            context={"request": request, "conversation": conversation},
        )
        serializer.is_valid(raise_exception=True)
        message = serializer.save()
        return Response(ChatMessageSerializer(message).data, status=status.HTTP_201_CREATED)


class EmergencyAlertListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = _emergency_alert_scope_for_user(self.request.user)
        institution_hash = self.request.query_params.get("institution_id")
        if institution_hash:
            institution_id = decode_id(institution_hash)
            if institution_id:
                queryset = queryset.filter(workspace__institution_id=institution_id)
            else:
                queryset = queryset.none()

        status_value = (self.request.query_params.get("status") or "").strip()
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset

    def get_serializer_class(self):
        if self.request.method == "POST":
            return EmergencyAlertCreateSerializer
        return EmergencyAlertSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        institution = serializer.validated_data["institution"]

        if not _can_manage_institution(request.user, institution.id):
            return Response(
                {"error": "You do not have access to create emergency alerts for this institution."},
                status=status.HTTP_403_FORBIDDEN,
            )

        alert = serializer.save()
        payload = EmergencyAlertSerializer(alert, context={"request": request}).data
        return Response(payload, status=status.HTTP_201_CREATED)


class EmergencyAlertDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return _emergency_alert_scope_for_user(self.request.user)

    def get_object(self):
        lookup = self.kwargs.get("pk")
        decoded_id = decode_id(lookup)
        if not decoded_id:
            from django.http import Http404

            raise Http404
        return self.get_queryset().get(id=decoded_id)

    def get_serializer_class(self):
        if self.request.method in {"PATCH", "PUT"}:
            return EmergencyAlertUpdateSerializer
        return EmergencyAlertSerializer

    def update(self, request, *args, **kwargs):
        alert = self.get_object()
        serializer = self.get_serializer(alert, data=request.data, partial=kwargs.pop("partial", False), context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(EmergencyAlertSerializer(alert, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def chat_conversation_create_incident_api(request, pk):
    decoded_id = decode_id(pk)
    if not decoded_id:
        return Response({"error": "Conversation not found"}, status=status.HTTP_404_NOT_FOUND)

    conversation = _conversation_scope_for_user(request.user).filter(id=decoded_id).first()
    if conversation is None:
        return Response({"error": "Conversation not found"}, status=status.HTTP_404_NOT_FOUND)
    if not conversation.workspace.allow_incident_creation:
        return Response(
            {"error": "Incident creation is disabled for this chat workspace."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if not _can_create_incident_from_conversation(request.user, conversation):
        return Response(
            {"error": "You are not allowed to create incidents from this conversation."},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = ChatConversationIncidentCreateSerializer(
        data=request.data,
        context={"request": request, "conversation": conversation},
    )
    serializer.is_valid(raise_exception=True)
    incident = serializer.save()
    return Response(
        {
            "incident_id": encode_id(incident.id),
            "conversation": ChatConversationSerializer(conversation, context={"request": request}).data,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def chat_conversation_ai_suggestions_api(request, pk):
    decoded_id = decode_id(pk)
    if not decoded_id:
        return Response({"error": "Conversation not found"}, status=status.HTTP_404_NOT_FOUND)

    conversation = _conversation_scope_for_user(request.user).filter(id=decoded_id).first()
    if conversation is None:
        return Response({"error": "Conversation not found"}, status=status.HTTP_404_NOT_FOUND)

    actor_label = request.user.get_full_name().strip() or request.user.username

    try:
        suggestions = generate_call_center_suggestions(
            conversation=conversation,
            actor_label=actor_label,
            include_admin_link=bool(getattr(request.user, "is_superuser", False)),
        )
    except AdminAssistantError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    return Response(
        {
            "summary": suggestions.get("summary") or "",
            "guidance": suggestions.get("guidance") or "",
            "buttons": suggestions.get("buttons") or [],
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def chat_conversation_assistant_reply_api(request, pk):
    decoded_id = decode_id(pk)
    if not decoded_id:
        return Response({"error": "Conversation not found"}, status=status.HTTP_404_NOT_FOUND)

    conversation = _conversation_scope_for_user(request.user).filter(id=decoded_id).first()
    if conversation is None:
        return Response({"error": "Conversation not found"}, status=status.HTTP_404_NOT_FOUND)

    prompt = (request.data.get("message") or "").strip()
    if not prompt:
        return Response({"error": "message is required."}, status=status.HTTP_400_BAD_REQUEST)

    actor_label = request.user.get_full_name().strip() or request.user.username

    try:
        agent_message = conversation.messages.create(
            sender_user=request.user,
            sender_type="agent",
            body=prompt,
            metadata={"message_type": "assistant_prompt"},
        )
        reply = generate_call_center_reply(
            conversation=conversation,
            actor_label=actor_label,
            prompt=prompt,
            include_admin_link=bool(getattr(request.user, "is_superuser", False)),
        )
    except AdminAssistantError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    agent_message_data = ChatMessageSerializer(agent_message).data
    assistant_message = ChatMessageSerializer(
        conversation.messages.create(
            sender_type="system",
            body=reply.get("reply") or "",
            metadata={
                "assistant_buttons": reply.get("buttons") or [],
                "assistant_type": "call_center",
                "assistant_prompt": prompt,
                "message_type": "assistant_reply",
            },
        )
    ).data
    ChatConversation.objects.filter(pk=conversation.pk).update(updated_at=timezone.now())

    return Response({"agent_message": agent_message_data, "message": assistant_message}, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def admin_ai_assistant_api(request):
    if not getattr(request.user, "is_superuser", False):
        return Response({"error": "Super admin access required."}, status=status.HTTP_403_FORBIDDEN)

    prompt = (request.data.get("message") or "").strip()
    history = request.data.get("history") or []
    if not prompt:
        return Response({"error": "message is required."}, status=status.HTTP_400_BAD_REQUEST)

    actor_label = request.user.get_full_name().strip() or request.user.username

    try:
        plan = generate_admin_assistant_plan(prompt=prompt, actor_label=actor_label, history=history)
    except AdminAssistantError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    actions = plan.get("actions") or []
    results = []
    execution_errors = []

    if not plan.get("requires_clarification"):
        for action in actions:
            try:
                results.append(execute_admin_action(action=action, actor=request.user))
            except AdminActionError as exc:
                message = str(exc)
                execution_errors.append(message)
                results.append(
                    {
                        "action_type": action.get("action_type"),
                        "status": "failed",
                        "message": message,
                        "data": {},
                    }
                )

    return Response(
        {
            "summary": plan.get("summary") or "",
            "operator_response": plan.get("operator_response") or "",
            "requires_clarification": bool(plan.get("requires_clarification")),
            "clarification_question": plan.get("clarification_question") or "",
            "actions": actions,
            "results": results,
            "execution_errors": execution_errors,
            "buttons": _admin_assistant_buttons(
                prompt=prompt,
                actions=actions,
                requires_clarification=bool(plan.get("requires_clarification")),
            ),
        },
        status=status.HTTP_200_OK,
    )
