# incidents/models.py
from django.conf import settings
from django.db import models
from accounts.models import Institution
from security.models import SecurityFacility


class Incident(models.Model):
    SOURCE_INTERNAL = "internal"
    SOURCE_PUBLIC = "public"
    SOURCE_CHOICES = [
        (SOURCE_INTERNAL, "Internal"),
        (SOURCE_PUBLIC, "Public"),
    ]

    INCIDENT_TYPES = [
        ('robbery', 'Robbery'),
        ('assault', 'Assault'),
        ('accident', 'Accident'),
        ('missing_person', 'Missing Person'),
        ('murder', 'Murder'),
        ('theft', 'Theft'),
        ('other', 'Other'),
    ]

    ob_number = models.CharField(max_length=50)
    incident_type = models.CharField(max_length=50, choices=INCIDENT_TYPES)
    description = models.TextField()
    facility = models.ForeignKey(SecurityFacility, on_delete=models.SET_NULL, null=True)
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="incidents", null=True, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    occurred_at = models.DateTimeField()
    reported_at = models.DateTimeField(auto_now_add=True)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default=SOURCE_INTERNAL)
    reporter_name = models.CharField(max_length=255, blank=True, default="")
    reporter_contact = models.CharField(max_length=255, blank=True, default="")
    public_location_hint = models.CharField(max_length=255, blank=True, default="")
    follow_up_status = models.CharField(
        max_length=20,
        choices=[("open", "Open"), ("in_progress", "In Progress"), ("resolved", "Resolved")],
        default="open",
    )
    follow_up_note = models.TextField(blank=True, default="")
    follow_up_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="incident_followups",
    )
    follow_up_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.incident_type} - {self.ob_number}"


class IncidentUpdate(models.Model):
    STATUS_CHOICES = [("open", "Open"), ("in_progress", "In Progress"), ("resolved", "Resolved")]

    incident = models.ForeignKey(Incident, on_delete=models.CASCADE, related_name="updates")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="open")
    note = models.TextField(blank=True, default="")
    action_taken = models.TextField(blank=True, default="")
    assigned_to_name = models.CharField(max_length=255, blank=True, default="")
    next_step = models.TextField(blank=True, default="")
    due_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="incident_updates",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"Update for {self.incident.ob_number} at {self.created_at:%Y-%m-%d %H:%M}"


class IncidentInstitutionAccess(models.Model):
    ACCESS_VIEWER = "viewer"
    ACCESS_CONTRIBUTOR = "contributor"
    ACCESS_LEAD = "lead"
    ACCESS_LEVEL_CHOICES = [
        (ACCESS_VIEWER, "Viewer"),
        (ACCESS_CONTRIBUTOR, "Contributor"),
        (ACCESS_LEAD, "Lead"),
    ]

    incident = models.ForeignKey(Incident, on_delete=models.CASCADE, related_name="institution_access")
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="incident_access")
    access_level = models.CharField(max_length=20, choices=ACCESS_LEVEL_CHOICES, default=ACCESS_CONTRIBUTOR)
    shared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="incident_access_grants",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=("incident", "institution"),
                name="unique_incident_institution_access",
            )
        ]

    def __str__(self):
        return f"{self.incident.ob_number} shared with {self.institution.name}"


class IncidentComment(models.Model):
    incident = models.ForeignKey(Incident, on_delete=models.CASCADE, related_name="comments")
    body = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="incident_comments",
    )
    actor_institution = models.ForeignKey(
        Institution,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="incident_comments",
    )
    actor_facility = models.ForeignKey(
        SecurityFacility,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="incident_comments",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"Comment on {self.incident.ob_number}"


class IncidentActivity(models.Model):
    ACTION_FOLLOW_UP_CHANGED = "follow_up_changed"
    ACTION_UPDATE_ADDED = "update_added"
    ACTION_COMMENT_ADDED = "comment_added"
    ACTION_INSTITUTION_SHARED = "institution_shared"
    ACTION_LOCATION_UPDATED = "location_updated"
    ACTION_CHOICES = [
        (ACTION_FOLLOW_UP_CHANGED, "Follow-up changed"),
        (ACTION_UPDATE_ADDED, "Update added"),
        (ACTION_COMMENT_ADDED, "Comment added"),
        (ACTION_INSTITUTION_SHARED, "Institution shared"),
        (ACTION_LOCATION_UPDATED, "Location updated"),
    ]

    incident = models.ForeignKey(Incident, on_delete=models.CASCADE, related_name="activity")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="incident_activity",
    )
    actor_institution = models.ForeignKey(
        Institution,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="incident_activity",
    )
    actor_facility = models.ForeignKey(
        SecurityFacility,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="incident_activity",
    )
    action_type = models.CharField(max_length=40, choices=ACTION_CHOICES)
    summary = models.CharField(max_length=255)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.action_type} on {self.incident.ob_number}"
