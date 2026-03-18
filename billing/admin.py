from django.contrib import admin

from .models import (
    BillingFeature,
    BillingPlan,
    InstitutionEntitlementOverride,
    InstitutionFeatureUsage,
    InstitutionSubscription,
    PaymentEvent,
    PaymentProviderCustomer,
    PlanEntitlement,
)


@admin.register(BillingPlan)
class BillingPlanAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "price_amount", "currency", "billing_interval", "is_active")
    list_filter = ("is_active", "billing_interval", "currency")
    search_fields = ("code", "name")


@admin.register(BillingFeature)
class BillingFeatureAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "value_type")
    search_fields = ("code", "name")


@admin.register(PlanEntitlement)
class PlanEntitlementAdmin(admin.ModelAdmin):
    list_display = ("plan", "feature", "is_enabled", "limit_value")
    list_filter = ("plan", "feature")


@admin.register(InstitutionSubscription)
class InstitutionSubscriptionAdmin(admin.ModelAdmin):
    list_display = ("institution", "plan", "status", "provider", "current_period_end")
    list_filter = ("status", "provider", "plan")
    search_fields = ("institution__name", "provider_customer_id", "provider_subscription_id")


@admin.register(InstitutionEntitlementOverride)
class InstitutionEntitlementOverrideAdmin(admin.ModelAdmin):
    list_display = ("institution", "feature", "is_enabled", "limit_value", "updated_by", "updated_at")
    list_filter = ("feature",)
    search_fields = ("institution__name", "feature__code", "reason")


@admin.register(PaymentProviderCustomer)
class PaymentProviderCustomerAdmin(admin.ModelAdmin):
    list_display = ("institution", "provider", "customer_id", "updated_at")
    list_filter = ("provider",)
    search_fields = ("institution__name", "customer_id")


@admin.register(InstitutionFeatureUsage)
class InstitutionFeatureUsageAdmin(admin.ModelAdmin):
    list_display = ("institution", "feature_code", "period_start", "usage_count", "updated_at")
    list_filter = ("feature_code", "period_start")
    search_fields = ("institution__name", "feature_code")


@admin.register(PaymentEvent)
class PaymentEventAdmin(admin.ModelAdmin):
    list_display = ("event_id", "provider", "event_type", "institution", "processed_at", "created_at")
    list_filter = ("provider", "event_type")
    search_fields = ("event_id", "provider_customer_id", "provider_subscription_id")
