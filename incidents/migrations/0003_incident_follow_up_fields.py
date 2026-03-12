from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("incidents", "0002_incident_institution"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="incident",
            name="follow_up_status",
            field=models.CharField(
                choices=[("open", "Open"), ("in_progress", "In Progress"), ("resolved", "Resolved")],
                default="open",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="incident",
            name="follow_up_note",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="incident",
            name="follow_up_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="incident_followups",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="incident",
            name="follow_up_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
