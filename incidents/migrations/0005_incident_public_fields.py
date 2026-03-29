from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("incidents", "0004_incidentupdate"),
    ]

    operations = [
        migrations.AddField(
            model_name="incident",
            name="public_location_hint",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="incident",
            name="reporter_contact",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="incident",
            name="reporter_name",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="incident",
            name="source",
            field=models.CharField(
                choices=[("internal", "Internal"), ("public", "Public")],
                default="internal",
                max_length=20,
            ),
        ),
    ]
