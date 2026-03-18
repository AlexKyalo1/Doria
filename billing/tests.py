from django.contrib.auth.models import User
from django.test import TestCase

from accounts.models import Institution, InstitutionMembership
from billing.constants import FEATURE_MAX_AI_QUERIES_PER_MONTH
from billing.models import BillingFeature, InstitutionEntitlementOverride
from billing.services.entitlements import (
    BillingLimitError,
    assert_ai_feature_enabled,
    assert_ai_usage_available,
    assert_member_limit_available,
    ensure_subscription_for_institution,
    increment_feature_usage,
)


class BillingEntitlementsTestCase(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="pass12345")
        self.institution = Institution.objects.create(
            name="Demo Institution",
            description="",
            owner=self.owner,
        )
        InstitutionMembership.objects.create(
            institution=self.institution,
            user=self.owner,
            role="admin",
        )
        self.subscription = ensure_subscription_for_institution(self.institution)

    def test_free_plan_blocks_ai_by_default(self):
        with self.assertRaisesMessage(BillingLimitError, "AI insights are not enabled for this institution."):
            assert_ai_feature_enabled(self.institution)

    def test_override_can_enable_ai(self):
        feature = BillingFeature.objects.get(code="ai_insights")
        InstitutionEntitlementOverride.objects.create(
            institution=self.institution,
            feature=feature,
            is_enabled=True,
        )
        assert_ai_feature_enabled(self.institution)

    def test_member_limit_applies_from_plan(self):
        for index in range(2, 6):
            user = User.objects.create_user(username=f"user{index}", password="pass12345")
            InstitutionMembership.objects.create(
                institution=self.institution,
                user=user,
                role="member",
            )

        with self.assertRaisesMessage(BillingLimitError, "This institution has reached its member limit."):
            assert_member_limit_available(self.institution)

    def test_ai_quota_limit_is_enforced(self):
        feature = BillingFeature.objects.get(code="ai_insights")
        InstitutionEntitlementOverride.objects.create(
            institution=self.institution,
            feature=feature,
            is_enabled=True,
        )

        for _ in range(5):
            increment_feature_usage(self.institution, FEATURE_MAX_AI_QUERIES_PER_MONTH)

        with self.assertRaisesMessage(BillingLimitError, "This institution has exhausted its monthly AI insights quota."):
            assert_ai_usage_available(self.institution)
