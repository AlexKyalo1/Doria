from django.db import migrations


def seed_chat_billing_features(apps, schema_editor):
    BillingFeature = apps.get_model("billing", "BillingFeature")
    BillingPlan = apps.get_model("billing", "BillingPlan")
    PlanEntitlement = apps.get_model("billing", "PlanEntitlement")

    features = {
        "chat_support": {
            "name": "Institution Chat Support",
            "description": "Allows the institution to use the customer care chat workspace.",
            "value_type": "boolean",
        },
        "max_chat_conversations_per_month": {
            "name": "Monthly Chat Conversations",
            "description": "Maximum chat conversations that can be opened each month.",
            "value_type": "limit",
        },
    }

    created_features = {}
    for code, values in features.items():
        created_features[code], _ = BillingFeature.objects.get_or_create(code=code, defaults=values)

    entitlement_defaults = {
        "free": {
            "chat_support": {"is_enabled": True},
            "max_chat_conversations_per_month": {"limit_value": 25},
        },
        "pro": {
            "chat_support": {"is_enabled": True},
            "max_chat_conversations_per_month": {"limit_value": 500},
        },
        "enterprise": {
            "chat_support": {"is_enabled": True},
            "max_chat_conversations_per_month": {"limit_value": 5000},
        },
    }

    for plan_code, entitlements in entitlement_defaults.items():
        plan = BillingPlan.objects.filter(code=plan_code).first()
        if plan is None:
            continue
        for feature_code, values in entitlements.items():
            PlanEntitlement.objects.get_or_create(
                plan=plan,
                feature=created_features[feature_code],
                defaults=values,
            )


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0002_institutionfeatureusage"),
    ]

    operations = [
        migrations.RunPython(seed_chat_billing_features, migrations.RunPython.noop),
    ]
