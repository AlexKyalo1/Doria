from decimal import Decimal

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def seed_billing_defaults(apps, schema_editor):
    BillingFeature = apps.get_model("billing", "BillingFeature")
    BillingPlan = apps.get_model("billing", "BillingPlan")
    PlanEntitlement = apps.get_model("billing", "PlanEntitlement")

    features = {
        "max_facilities": {
            "name": "Maximum Facilities",
            "description": "Maximum number of facilities the institution may create.",
            "value_type": "limit",
        },
        "max_members": {
            "name": "Maximum Members",
            "description": "Maximum number of institution members.",
            "value_type": "limit",
        },
        "ai_insights": {
            "name": "AI Insights",
            "description": "Allows use of AI-powered incident insights.",
            "value_type": "boolean",
        },
        "max_ai_queries_per_month": {
            "name": "Monthly AI Queries",
            "description": "Maximum AI insight requests per month.",
            "value_type": "limit",
        },
    }

    created_features = {}
    for code, values in features.items():
        created_features[code], _ = BillingFeature.objects.get_or_create(
            code=code,
            defaults=values,
        )

    plans = {
        "free": {
            "name": "Free",
            "description": "Starter access for a single institution.",
            "price_amount": Decimal("0.00"),
            "currency": "usd",
            "billing_interval": "month",
            "is_active": True,
            "entitlements": {
                "max_facilities": {"limit_value": 2},
                "max_members": {"limit_value": 5},
                "ai_insights": {"is_enabled": False},
                "max_ai_queries_per_month": {"limit_value": 0},
            },
        },
        "pro": {
            "name": "Pro",
            "description": "Growing institutions with AI access and larger limits.",
            "price_amount": Decimal("49.00"),
            "currency": "usd",
            "billing_interval": "month",
            "is_active": True,
            "entitlements": {
                "max_facilities": {"limit_value": 25},
                "max_members": {"limit_value": 50},
                "ai_insights": {"is_enabled": True},
                "max_ai_queries_per_month": {"limit_value": 200},
            },
        },
        "enterprise": {
            "name": "Enterprise",
            "description": "High-capacity institutions with premium access.",
            "price_amount": Decimal("199.00"),
            "currency": "usd",
            "billing_interval": "month",
            "is_active": True,
            "entitlements": {
                "max_facilities": {"limit_value": 250},
                "max_members": {"limit_value": 500},
                "ai_insights": {"is_enabled": True},
                "max_ai_queries_per_month": {"limit_value": 2000},
            },
        },
    }

    for code, plan_values in plans.items():
        entitlements = plan_values["entitlements"]
        defaults = {key: value for key, value in plan_values.items() if key != "entitlements"}
        plan, _ = BillingPlan.objects.get_or_create(code=code, defaults=defaults)
        for feature_code, entitlement_values in entitlements.items():
            PlanEntitlement.objects.get_or_create(
                plan=plan,
                feature=created_features[feature_code],
                defaults=entitlement_values,
            )


def assign_free_plan_to_existing_institutions(apps, schema_editor):
    Institution = apps.get_model("accounts", "Institution")
    BillingPlan = apps.get_model("billing", "BillingPlan")
    InstitutionSubscription = apps.get_model("billing", "InstitutionSubscription")

    free_plan = BillingPlan.objects.filter(code="free").first()
    for institution in Institution.objects.all():
        InstitutionSubscription.objects.get_or_create(
            institution=institution,
            defaults={
                "plan": free_plan,
                "status": "active",
                "provider": "manual",
                "metadata": {},
            },
        )


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="BillingFeature",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.SlugField(max_length=100, unique=True)),
                ("name", models.CharField(max_length=100)),
                ("description", models.TextField(blank=True)),
                ("value_type", models.CharField(choices=[("boolean", "Boolean"), ("limit", "Limit")], default="boolean", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["code"]},
        ),
        migrations.CreateModel(
            name="BillingPlan",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.SlugField(max_length=50, unique=True)),
                ("name", models.CharField(max_length=100)),
                ("description", models.TextField(blank=True)),
                ("price_amount", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("currency", models.CharField(default="usd", max_length=10)),
                ("billing_interval", models.CharField(choices=[("month", "Monthly"), ("year", "Yearly")], default="month", max_length=10)),
                ("stripe_price_id", models.CharField(blank=True, max_length=255)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["price_amount", "name"]},
        ),
        migrations.CreateModel(
            name="InstitutionSubscription",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("trialing", "Trialing"), ("active", "Active"), ("past_due", "Past Due"), ("canceled", "Canceled"), ("paused", "Paused")], default="active", max_length=20)),
                ("provider", models.CharField(choices=[("manual", "Manual"), ("stripe", "Stripe")], default="manual", max_length=20)),
                ("provider_customer_id", models.CharField(blank=True, max_length=255)),
                ("provider_subscription_id", models.CharField(blank=True, max_length=255)),
                ("current_period_start", models.DateTimeField(blank=True, null=True)),
                ("current_period_end", models.DateTimeField(blank=True, null=True)),
                ("trial_ends_at", models.DateTimeField(blank=True, null=True)),
                ("cancel_at_period_end", models.BooleanField(default=False)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("institution", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="subscription", to="accounts.institution")),
                ("plan", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="subscriptions", to="billing.billingplan")),
            ],
            options={"ordering": ["institution__name"]},
        ),
        migrations.CreateModel(
            name="PaymentProviderCustomer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("provider", models.CharField(choices=[("manual", "Manual"), ("stripe", "Stripe")], max_length=20)),
                ("customer_id", models.CharField(max_length=255)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("institution", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="provider_customers", to="accounts.institution")),
            ],
        ),
        migrations.CreateModel(
            name="PaymentEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("provider", models.CharField(choices=[("manual", "Manual"), ("stripe", "Stripe")], max_length=20)),
                ("event_id", models.CharField(max_length=255, unique=True)),
                ("event_type", models.CharField(max_length=255)),
                ("provider_customer_id", models.CharField(blank=True, max_length=255)),
                ("provider_subscription_id", models.CharField(blank=True, max_length=255)),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("processed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("institution", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="payment_events", to="accounts.institution")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="PlanEntitlement",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("is_enabled", models.BooleanField(blank=True, null=True)),
                ("limit_value", models.PositiveIntegerField(blank=True, null=True)),
                ("feature", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="plan_entitlements", to="billing.billingfeature")),
                ("plan", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="entitlements", to="billing.billingplan")),
            ],
        ),
        migrations.CreateModel(
            name="InstitutionEntitlementOverride",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("is_enabled", models.BooleanField(blank=True, null=True)),
                ("limit_value", models.PositiveIntegerField(blank=True, null=True)),
                ("reason", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("feature", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="institution_overrides", to="billing.billingfeature")),
                ("institution", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="entitlement_overrides", to="accounts.institution")),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="billing_overrides_updated", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddConstraint(
            model_name="paymentprovidercustomer",
            constraint=models.UniqueConstraint(fields=("institution", "provider"), name="unique_provider_customer"),
        ),
        migrations.AddConstraint(
            model_name="planentitlement",
            constraint=models.UniqueConstraint(fields=("plan", "feature"), name="unique_plan_entitlement"),
        ),
        migrations.AddConstraint(
            model_name="institutionentitlementoverride",
            constraint=models.UniqueConstraint(fields=("institution", "feature"), name="unique_institution_override"),
        ),
        migrations.RunPython(seed_billing_defaults, migrations.RunPython.noop),
        migrations.RunPython(assign_free_plan_to_existing_institutions, migrations.RunPython.noop),
    ]
