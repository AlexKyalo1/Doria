from rest_framework import serializers

from accounts.models import Institution
from utils.hashid import decode_id
from utils.hashid_field import HashIdField
from .models import (
    BillingFeature,
    BillingPlan,
    InstitutionEntitlementOverride,
    InstitutionSubscription,
    PaymentEvent,
    PlanEntitlement,
)
from .services.entitlements import get_entitlements_for_institution


class BillingFeatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillingFeature
        fields = ["code", "name", "description", "value_type"]


class PlanEntitlementSerializer(serializers.ModelSerializer):
    feature = BillingFeatureSerializer(read_only=True)

    class Meta:
        model = PlanEntitlement
        fields = ["feature", "is_enabled", "limit_value"]


class BillingPlanSerializer(serializers.ModelSerializer):
    entitlements = PlanEntitlementSerializer(many=True, read_only=True)

    class Meta:
        model = BillingPlan
        fields = [
            "id",
            "code",
            "name",
            "description",
            "price_amount",
            "currency",
            "billing_interval",
            "stripe_price_id",
            "is_active",
            "entitlements",
        ]


class InstitutionSubscriptionSerializer(serializers.ModelSerializer):
    institution_id = HashIdField(read_only=True)
    plan = BillingPlanSerializer(read_only=True)

    class Meta:
        model = InstitutionSubscription
        fields = [
            "institution_id",
            "plan",
            "status",
            "provider",
            "current_period_start",
            "current_period_end",
            "trial_ends_at",
            "cancel_at_period_end",
            "metadata",
            "updated_at",
        ]


class InstitutionEntitlementOverrideSerializer(serializers.ModelSerializer):
    institution_id = HashIdField(read_only=True)
    feature = BillingFeatureSerializer(read_only=True)
    feature_code = serializers.SlugField(source="feature.code", read_only=True)
    updated_by_username = serializers.ReadOnlyField(source="updated_by.username")

    class Meta:
        model = InstitutionEntitlementOverride
        fields = [
            "institution_id",
            "feature",
            "feature_code",
            "is_enabled",
            "limit_value",
            "reason",
            "updated_by_username",
            "updated_at",
        ]


class InstitutionBillingSnapshotSerializer(serializers.Serializer):
    subscription = InstitutionSubscriptionSerializer(allow_null=True)
    entitlements = serializers.SerializerMethodField()
    overrides = InstitutionEntitlementOverrideSerializer(many=True)

    def get_entitlements(self, obj):
        institution = obj["institution"]
        return get_entitlements_for_institution(institution)


class CheckoutSessionRequestSerializer(serializers.Serializer):
    plan_code = serializers.SlugField()
    success_url = serializers.URLField(required=False)
    cancel_url = serializers.URLField(required=False)


class AdminSubscriptionUpdateSerializer(serializers.Serializer):
    plan_code = serializers.SlugField(required=False, allow_blank=False)
    status = serializers.ChoiceField(
        choices=InstitutionSubscription.STATUS_CHOICES,
        required=False,
    )
    provider = serializers.ChoiceField(
        choices=InstitutionSubscription.PROVIDER_CHOICES,
        required=False,
    )
    current_period_start = serializers.DateTimeField(required=False, allow_null=True)
    current_period_end = serializers.DateTimeField(required=False, allow_null=True)
    trial_ends_at = serializers.DateTimeField(required=False, allow_null=True)
    cancel_at_period_end = serializers.BooleanField(required=False)
    metadata = serializers.JSONField(required=False)


class AdminEntitlementOverrideInputSerializer(serializers.Serializer):
    feature_code = serializers.SlugField()
    is_enabled = serializers.BooleanField(required=False, allow_null=True)
    limit_value = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=255)

    def validate(self, attrs):
        if "is_enabled" not in attrs and "limit_value" not in attrs:
            raise serializers.ValidationError("Provide is_enabled or limit_value.")
        return attrs


class PaymentEventSerializer(serializers.ModelSerializer):
    institution_id = HashIdField(read_only=True)

    class Meta:
        model = PaymentEvent
        fields = [
            "id",
            "institution_id",
            "provider",
            "event_id",
            "event_type",
            "provider_customer_id",
            "provider_subscription_id",
            "processed_at",
            "created_at",
        ]


def get_institution_by_hash(institution_hash):
    institution_id = decode_id(institution_hash)
    if not institution_id:
        return None
    try:
        return Institution.objects.get(id=institution_id)
    except Institution.DoesNotExist:
        return None

