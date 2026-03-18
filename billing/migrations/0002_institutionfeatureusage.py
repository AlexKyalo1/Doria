from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="InstitutionFeatureUsage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("feature_code", models.CharField(max_length=100)),
                ("period_start", models.DateField()),
                ("usage_count", models.PositiveIntegerField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("institution", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="feature_usage_records", to="accounts.institution")),
            ],
            options={"ordering": ["-period_start", "feature_code"]},
        ),
        migrations.AddConstraint(
            model_name="institutionfeatureusage",
            constraint=models.UniqueConstraint(fields=("institution", "feature_code", "period_start"), name="unique_institution_feature_usage_period"),
        ),
    ]
