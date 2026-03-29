from django.conf import settings
from django.db import models

from accounts.models import Institution
from incidents.models import Incident
from security.models import SecurityFacility


class InstitutionChatWorkspace(models.Model):
    institution = models.OneToOneField(
        Institution,
        on_delete=models.CASCADE,
        related_name="chat_workspace",
    )
    is_enabled = models.BooleanField(default=True)
    allow_incident_creation = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["institution__name"]

    def __str__(self):
        return f"Chat workspace for {self.institution.name}"


class ChatConversation(models.Model):
    STATUS_OPEN = "open"
    STATUS_PENDING = "pending"
    STATUS_CLOSED = "closed"
    STATUS_CHOICES = (
        (STATUS_OPEN, "Open"),
        (STATUS_PENDING, "Pending"),
        (STATUS_CLOSED, "Closed"),
    )

    SOURCE_WEB = "web"
    SOURCE_APP = "app"
    SOURCE_CHOICES = (
        (SOURCE_WEB, "Web"),
        (SOURCE_APP, "App"),
    )

    workspace = models.ForeignKey(
        InstitutionChatWorkspace,
        on_delete=models.CASCADE,
        related_name="conversations",
    )
    facility = models.ForeignKey(
        SecurityFacility,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_conversations",
    )
    incident = models.ForeignKey(
        Incident,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_conversations",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_OPEN)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default=SOURCE_WEB)
    subject = models.CharField(max_length=255, blank=True, default="")
    customer_name = models.CharField(max_length=255, blank=True, default="")
    customer_contact = models.CharField(max_length=255, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_conversations_created",
    )
    assigned_agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_conversations_assigned",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]

    def __str__(self):
        return f"Conversation #{self.id} for {self.workspace.institution.name}"


class ChatMessage(models.Model):
    SENDER_CUSTOMER = "customer"
    SENDER_AGENT = "agent"
    SENDER_SYSTEM = "system"
    SENDER_CHOICES = (
        (SENDER_CUSTOMER, "Customer"),
        (SENDER_AGENT, "Agent"),
        (SENDER_SYSTEM, "System"),
    )

    conversation = models.ForeignKey(
        ChatConversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_messages",
    )
    sender_type = models.CharField(max_length=20, choices=SENDER_CHOICES, default=SENDER_AGENT)
    body = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.sender_type} message in conversation #{self.conversation_id}"


class ChatActionLog(models.Model):
    ACTION_CREATE_INCIDENT = "create_incident"
    ACTION_CHOICES = (
        (ACTION_CREATE_INCIDENT, "Create incident"),
    )

    STATUS_REQUESTED = "requested"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = (
        (STATUS_REQUESTED, "Requested"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_FAILED, "Failed"),
    )

    conversation = models.ForeignKey(
        ChatConversation,
        on_delete=models.CASCADE,
        related_name="action_logs",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_action_logs",
    )
    action_type = models.CharField(max_length=50, choices=ACTION_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_REQUESTED)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.action_type} ({self.status})"


class EmergencyAlert(models.Model):
    STATUS_NEW = "new"
    STATUS_ACKNOWLEDGED = "acknowledged"
    STATUS_DISPATCHED = "dispatched"
    STATUS_RESOLVED = "resolved"
    STATUS_CHOICES = (
        (STATUS_NEW, "New"),
        (STATUS_ACKNOWLEDGED, "Acknowledged"),
        (STATUS_DISPATCHED, "Dispatched"),
        (STATUS_RESOLVED, "Resolved"),
    )

    workspace = models.ForeignKey(
        InstitutionChatWorkspace,
        on_delete=models.CASCADE,
        related_name="emergency_alerts",
    )
    facility = models.ForeignKey(
        SecurityFacility,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="emergency_alerts",
    )
    incident = models.ForeignKey(
        Incident,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="emergency_alerts",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="emergency_alerts_created",
    )
    assigned_operator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="emergency_alerts_assigned",
    )
    incident_type = models.CharField(max_length=50, choices=Incident.INCIDENT_TYPES)
    summary = models.TextField()
    location_label = models.CharField(max_length=255, blank=True, default="")
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_NEW)
    operator_notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["status", "-updated_at", "-id"]

    def __str__(self):
        return f"Emergency alert #{self.id} for {self.workspace.institution.name}"
