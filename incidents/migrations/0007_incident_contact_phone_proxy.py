from django.db import migrations, models


def build_proxy_phone_from_id(incident_id):
    return f"+254799{int(incident_id):06d}"


def populate_incident_phone_fields(apps, schema_editor):
    Incident = apps.get_model("incidents", "Incident")
    for incident in Incident.objects.all():
        changed = False
        if not incident.contact_phone and incident.reporter_contact:
            incident.contact_phone = incident.reporter_contact
            changed = True
        if not incident.proxy_phone_number and (incident.contact_phone or incident.reporter_contact):
            incident.proxy_phone_number = build_proxy_phone_from_id(incident.id)
            changed = True
        if changed:
            incident.save(update_fields=["contact_phone", "proxy_phone_number"])


def clear_incident_proxy_fields(apps, schema_editor):
    Incident = apps.get_model("incidents", "Incident")
    Incident.objects.update(proxy_phone_number=None)


class Migration(migrations.Migration):

    dependencies = [
        ("incidents", "0006_incident_collaboration_models"),
    ]

    operations = [
        migrations.AddField(
            model_name="incident",
            name="contact_phone",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
        migrations.AddField(
            model_name="incident",
            name="proxy_phone_number",
            field=models.CharField(blank=True, max_length=32, null=True, unique=True),
        ),
        migrations.RunPython(populate_incident_phone_fields, clear_incident_proxy_fields),
    ]
