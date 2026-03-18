from django.conf import settings
from django.db import models

from accounts.models import Institution
from .constants import PROVIDER_MANUAL, PROVIDER_STRIPE


class BillingPlan(models.Model):
    INTERVAL_MONTH = "month"
    INTERVAL_YEAR = "year"
    INTERVAL_CHOICES = (
        (INTERVAL_MONTH, "Monthly"),
        (INTERVAL_YEAR, "Yearly"),
    )

    code = models.SlugField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    price_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currency = models.CharField(max_length=10, default="usd")
    billing_interval = models.CharField(
        max_length=10,
        choices=INTERVAL_CHOICES,
        default=INTERVAL_MONTH,
    )
    stripe_price_id = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["price_amount", "name"]

    def __str__(self):
        return self.name


class BillingFeature(models.Model):
    VALUE_BOOLEAN = "boolean"
    VALUE_LIMIT = "limit"
    VALUE_TYPE_CHOICES = (
        (VALUE_BOOLEAN, "Boolean"),
        (VALUE_LIMIT, "Limit"),
    )

    code = models.SlugField(max_length=100, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    value_type = models.CharField(
        max_length=20,
        choices=VALUE_TYPE_CHOICES,
        default=VALUE_BOOLEAN,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return self.name


class PlanEntitlement(models.Model):
    plan = models.ForeignKey(
        BillingPlan,
        on_delete=models.CASCADE,
        related_name="entitlements",
    )
    feature = models.ForeignKey(
        BillingFeature,
        on_delete=models.CASCADE,
        related_name="plan_entitlements",
    )
    is_enabled = models.BooleanField(null=True, blank=True)
    limit_value = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("plan", "feature"),
                name="unique_plan_entitlement",
            )
        ]

    def __str__(self):
        return f"{self.plan.code}:{self.feature.code}"


class InstitutionSubscription(models.Model):
    STATUS_TRIALING = "trialing"
    STATUS_ACTIVE = "active"
    STATUS_PAST_DUE = "past_due"
    STATUS_CANCELED = "canceled"
    STATUS_PAUSED = "paused"
    STATUS_CHOICES = (
        (STATUS_TRIALING, "Trialing"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_PAST_DUE, "Past Due"),
        (STATUS_CANCELED, "Canceled"),
        (STATUS_PAUSED, "Paused"),
    )

    PROVIDER_CHOICES = (
        (PROVIDER_MANUAL, "Manual"),
        (PROVIDER_STRIPE, "Stripe"),
    )

    institution = models.OneToOneField(
        Institution,
        on_delete=models.CASCADE,
        related_name="subscription",
    )
    plan = models.ForeignKey(
        BillingPlan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subscriptions",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    provider = models.CharField(
        max_length=20,
        choices=PROVIDER_CHOICES,
        default=PROVIDER_MANUAL,
    )
    provider_customer_id = models.CharField(max_length=255, blank=True)
    provider_subscription_id = models.CharField(max_length=255, blank=True)
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["institution__name"]

    def __str__(self):
        return f"{self.institution.name} ({self.status})"


class InstitutionEntitlementOverride(models.Model):
    institution = models.ForeignKey(
        Institution,
        on_delete=models.CASCADE,
        related_name="entitlement_overrides",
    )
    feature = models.ForeignKey(
        BillingFeature,
        on_delete=models.CASCADE,
        related_name="institution_overrides",
    )
    is_enabled = models.BooleanField(null=True, blank=True)
    limit_value = models.PositiveIntegerField(null=True, blank=True)
    reason = models.CharField(max_length=255, blank=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="billing_overrides_updated",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("institution", "feature"),
                name="unique_institution_override",
            )
        ]

    def __str__(self):
        return f"{self.institution.name}:{self.feature.code}"


class PaymentProviderCustomer(models.Model):
    institution = models.ForeignKey(
        Institution,
        on_delete=models.CASCADE,
        related_name="provider_customers",
    )
    provider = models.CharField(max_length=20, choices=InstitutionSubscription.PROVIDER_CHOICES)
    customer_id = models.CharField(max_length=255)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("institution", "provider"),
                name="unique_provider_customer",
            )
        ]

    def __str__(self):
        return f"{self.institution.name}:{self.provider}"



class InstitutionFeatureUsage(models.Model):
    institution = models.ForeignKey(
        Institution,
        on_delete=models.CASCADE,
        related_name="feature_usage_records",
    )
    feature_code = models.CharField(max_length=100)
    period_start = models.DateField()
    usage_count = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("institution", "feature_code", "period_start"),
                name="unique_institution_feature_usage_period",
            )
        ]
        ordering = ["-period_start", "feature_code"]

    def __str__(self):
        return f"{self.institution.name}:{self.feature_code}:{self.period_start}"

class PaymentEvent(models.Model):
    institution = models.ForeignKey(
        Institution,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payment_events",
    )
    provider = models.CharField(max_length=20, choices=InstitutionSubscription.PROVIDER_CHOICES)
    event_id = models.CharField(max_length=255, unique=True)
    event_type = models.CharField(max_length=255)
    provider_customer_id = models.CharField(max_length=255, blank=True)
    provider_subscription_id = models.CharField(max_length=255, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.provider}:{self.event_type}"

