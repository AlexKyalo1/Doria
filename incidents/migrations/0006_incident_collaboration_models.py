from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "__first__"),
        ("security", "__first__"),
        ("incidents", "0005_incident_public_fields"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="IncidentActivity",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "action_type",
                    models.CharField(
                        choices=[
                            ("follow_up_changed", "Follow-up changed"),
                            ("update_added", "Update added"),
                            ("comment_added", "Comment added"),
                            ("institution_shared", "Institution shared"),
                            ("location_updated", "Location updated"),
                        ],
                        max_length=40,
                    ),
                ),
                ("summary", models.CharField(max_length=255)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="incident_activity",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "actor_facility",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="incident_activity",
                        to="security.securityfacility",
                    ),
                ),
                (
                    "actor_institution",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="incident_activity",
                        to="accounts.institution",
                    ),
                ),
                (
                    "incident",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="activity",
                        to="incidents.incident",
                    ),
                ),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
        migrations.CreateModel(
            name="IncidentComment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("body", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "actor_facility",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="incident_comments",
                        to="security.securityfacility",
                    ),
                ),
                (
                    "actor_institution",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="incident_comments",
                        to="accounts.institution",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="incident_comments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "incident",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="comments",
                        to="incidents.incident",
                    ),
                ),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
        migrations.CreateModel(
            name="IncidentInstitutionAccess",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "access_level",
                    models.CharField(
                        choices=[
                            ("viewer", "Viewer"),
                            ("contributor", "Contributor"),
                            ("lead", "Lead"),
                        ],
                        default="contributor",
                        max_length=20,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "incident",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="institution_access",
                        to="incidents.incident",
                    ),
                ),
                (
                    "institution",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="incident_access",
                        to="accounts.institution",
                    ),
                ),
                (
                    "shared_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="incident_access_grants",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["created_at", "id"]},
        ),
        migrations.AddConstraint(
            model_name="incidentinstitutionaccess",
            constraint=models.UniqueConstraint(
                fields=("incident", "institution"),
                name="unique_incident_institution_access",
            ),
        ),
    ]
