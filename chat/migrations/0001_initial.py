from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("accounts", "0001_initial"),
        ("incidents", "0004_incidentupdate"),
        ("security", "0003_blockedip"),
    ]

    operations = [
        migrations.CreateModel(
            name="InstitutionChatWorkspace",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("is_enabled", models.BooleanField(default=True)),
                ("allow_incident_creation", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("institution", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="chat_workspace", to="accounts.institution")),
            ],
            options={"ordering": ["institution__name"]},
        ),
        migrations.CreateModel(
            name="ChatConversation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("open", "Open"), ("pending", "Pending"), ("closed", "Closed")], default="open", max_length=20)),
                ("source", models.CharField(choices=[("web", "Web"), ("app", "App")], default="web", max_length=20)),
                ("subject", models.CharField(blank=True, default="", max_length=255)),
                ("customer_name", models.CharField(blank=True, default="", max_length=255)),
                ("customer_contact", models.CharField(blank=True, default="", max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("assigned_agent", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="chat_conversations_assigned", to=settings.AUTH_USER_MODEL)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="chat_conversations_created", to=settings.AUTH_USER_MODEL)),
                ("facility", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="chat_conversations", to="security.securityfacility")),
                ("incident", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="chat_conversations", to="incidents.incident")),
                ("workspace", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="conversations", to="chat.institutionchatworkspace")),
            ],
            options={"ordering": ["-updated_at", "-id"]},
        ),
        migrations.CreateModel(
            name="ChatMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sender_type", models.CharField(choices=[("customer", "Customer"), ("agent", "Agent"), ("system", "System")], default="agent", max_length=20)),
                ("body", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("conversation", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="messages", to="chat.chatconversation")),
                ("sender_user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="chat_messages", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["created_at", "id"]},
        ),
        migrations.CreateModel(
            name="ChatActionLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("action_type", models.CharField(choices=[("create_incident", "Create incident")], max_length=50)),
                ("status", models.CharField(choices=[("requested", "Requested"), ("completed", "Completed"), ("failed", "Failed")], default="requested", max_length=20)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("actor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="chat_action_logs", to=settings.AUTH_USER_MODEL)),
                ("conversation", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="action_logs", to="chat.chatconversation")),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
    ]
