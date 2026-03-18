from django.db import transaction
from django.db.models import F
from django.utils import timezone

from accounts.models import InstitutionMembership
from security.models import SecurityFacility
from billing.constants import (
    DEFAULT_FREE_PLAN_CODE,
    FEATURE_AI_INSIGHTS,
    FEATURE_MAX_AI_QUERIES_PER_MONTH,
    FEATURE_MAX_FACILITIES,
    FEATURE_MAX_MEMBERS,
    SUBSCRIPTION_STATUS_ACTIVE,
)
from billing.models import BillingFeature, BillingPlan, InstitutionFeatureUsage, InstitutionSubscription


class BillingLimitError(Exception):
    pass


def current_billing_period_start():
    today = timezone.now().date()
    return today.replace(day=1)


def ensure_subscription_for_institution(institution):
    subscription = getattr(institution, "subscription", None)
    if subscription:
        return subscription

    free_plan = BillingPlan.objects.filter(code=DEFAULT_FREE_PLAN_CODE).first()
    with transaction.atomic():
        subscription, _ = InstitutionSubscription.objects.get_or_create(
            institution=institution,
            defaults={
                "plan": free_plan,
                "status": SUBSCRIPTION_STATUS_ACTIVE,
            },
        )
    return subscription


def get_entitlements_for_institution(institution):
    subscription = ensure_subscription_for_institution(institution)
    entitlements = {}

    for feature in BillingFeature.objects.all():
        entitlements[feature.code] = {
            "code": feature.code,
            "value_type": feature.value_type,
            "is_enabled": None,
            "limit_value": None,
            "source": "default",
        }

    plan = subscription.plan or BillingPlan.objects.filter(code=DEFAULT_FREE_PLAN_CODE).first()
    if plan:
        for entitlement in plan.entitlements.select_related("feature").all():
            entitlements[entitlement.feature.code] = {
                "code": entitlement.feature.code,
                "value_type": entitlement.feature.value_type,
                "is_enabled": entitlement.is_enabled,
                "limit_value": entitlement.limit_value,
                "source": "plan",
            }

    for override in institution.entitlement_overrides.select_related("feature").all():
        entry = entitlements.setdefault(
            override.feature.code,
            {
                "code": override.feature.code,
                "value_type": override.feature.value_type,
                "is_enabled": None,
                "limit_value": None,
                "source": "default",
            },
        )
        if override.is_enabled is not None:
            entry["is_enabled"] = override.is_enabled
        if override.limit_value is not None:
            entry["limit_value"] = override.limit_value
        entry["source"] = "override"

    return sorted(entitlements.values(), key=lambda item: item["code"])


def get_entitlement(institution, feature_code):
    entitlements = get_entitlements_for_institution(institution)
    for entitlement in entitlements:
        if entitlement["code"] == feature_code:
            return entitlement
    return {
        "code": feature_code,
        "value_type": "boolean",
        "is_enabled": None,
        "limit_value": None,
        "source": "default",
    }


def is_feature_enabled(institution, feature_code, default=False):
    entitlement = get_entitlement(institution, feature_code)
    if entitlement["is_enabled"] is None:
        return default
    return entitlement["is_enabled"]


def get_limit(institution, feature_code, default=None):
    entitlement = get_entitlement(institution, feature_code)
    if entitlement["limit_value"] is None:
        return default
    return entitlement["limit_value"]


def get_feature_usage(institution, feature_code, *, period_start=None):
    period_start = period_start or current_billing_period_start()
    usage = InstitutionFeatureUsage.objects.filter(
        institution=institution,
        feature_code=feature_code,
        period_start=period_start,
    ).first()
    return usage.usage_count if usage else 0


def increment_feature_usage(institution, feature_code, *, amount=1, period_start=None):
    period_start = period_start or current_billing_period_start()
    with transaction.atomic():
        usage, created = InstitutionFeatureUsage.objects.get_or_create(
            institution=institution,
            feature_code=feature_code,
            period_start=period_start,
            defaults={"usage_count": amount},
        )
        if not created:
            InstitutionFeatureUsage.objects.filter(pk=usage.pk).update(
                usage_count=F("usage_count") + amount
            )
            usage.refresh_from_db()
    return usage.usage_count


def get_ai_usage_summary(institution):
    limit_value = get_limit(institution, FEATURE_MAX_AI_QUERIES_PER_MONTH)
    used = get_feature_usage(institution, FEATURE_MAX_AI_QUERIES_PER_MONTH)
    remaining = None if limit_value is None else max(limit_value - used, 0)
    return {
        "used": used,
        "limit": limit_value,
        "remaining": remaining,
        "period_start": current_billing_period_start().isoformat(),
    }


def assert_facility_limit_available(institution, *, excluding_facility_id=None):
    max_facilities = get_limit(institution, FEATURE_MAX_FACILITIES)
    if max_facilities is None:
        return
    queryset = SecurityFacility.objects.filter(institution=institution)
    if excluding_facility_id is not None:
        queryset = queryset.exclude(id=excluding_facility_id)
    current_total = queryset.count()
    if current_total >= max_facilities:
        raise BillingLimitError("This institution has reached its facility limit.")


def assert_member_limit_available(institution):
    max_members = get_limit(institution, FEATURE_MAX_MEMBERS)
    if max_members is None:
        return
    current_total = InstitutionMembership.objects.filter(institution=institution).count()
    if current_total >= max_members:
        raise BillingLimitError("This institution has reached its member limit.")


def assert_ai_feature_enabled(institution):
    if not is_feature_enabled(institution, FEATURE_AI_INSIGHTS, default=False):
        raise BillingLimitError("AI insights are not enabled for this institution.")


def assert_ai_usage_available(institution):
    summary = get_ai_usage_summary(institution)
    limit_value = summary["limit"]
    if limit_value is None:
        return summary
    if summary["used"] >= limit_value:
        raise BillingLimitError("This institution has exhausted its monthly AI insights quota.")
    return summary
