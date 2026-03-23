from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("incidents", "0003_incident_follow_up_fields"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="IncidentUpdate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("open", "Open"), ("in_progress", "In Progress"), ("resolved", "Resolved")], default="open", max_length=20)),
                ("note", models.TextField(blank=True, default="")),
                ("action_taken", models.TextField(blank=True, default="")),
                ("assigned_to_name", models.CharField(blank=True, default="", max_length=255)),
                ("next_step", models.TextField(blank=True, default="")),
                ("due_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="incident_updates", to=settings.AUTH_USER_MODEL)),
                ("incident", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="updates", to="incidents.incident")),
            ],
            options={
                "ordering": ["-created_at", "-id"],
            },
        ),
    ]
