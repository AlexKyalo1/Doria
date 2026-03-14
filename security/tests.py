from datetime import timedelta

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import FacilityMembership, Institution
from security.models import BlockedIP, SecurityFacility


@override_settings(
    SECURITY_IP_WHITELIST=[],
    SECURITY_RESPONSE_RULES={
        404: {
            "threshold": 2,
            "window_seconds": 60,
            "block_seconds": 600,
            "reason": "Repeated 404 probing detected",
        },
        403: {
            "threshold": 2,
            "window_seconds": 60,
            "block_seconds": 600,
            "reason": "Repeated forbidden access attempts detected",
        },
        503: {
            "threshold": 2,
            "window_seconds": 60,
            "block_seconds": 600,
            "reason": "Repeated service disruption triggering detected",
        },
    },
)
class FacilityVisibilityTests(APITestCase):
    def setUp(self):
        cache.clear()
        BlockedIP.objects.all().delete()
        self.owner = User.objects.create_user(username="owner2", password="pass12345")
        self.member = User.objects.create_user(username="member2", password="pass12345")
        self.outsider = User.objects.create_user(username="outsider2", password="pass12345")
        self.staff = User.objects.create_user(username="staff1", password="pass12345", is_staff=True)

        self.institution = Institution.objects.create(
            name="Test Institution 2",
            owner=self.owner,
        )
        self.facility = SecurityFacility.objects.create(
            name="North Station",
            institution=self.institution,
            facility_type="police_station",
            county="Nairobi",
            sub_county="Kasarani",
            latitude="-1.200000",
            longitude="36.900000",
        )
        FacilityMembership.objects.create(facility=self.facility, user=self.member, role="member")
        self.block = BlockedIP.objects.create(
            ip_address="10.10.10.10",
            trigger_status=404,
            hit_count=5,
            last_path="/.env",
            reason="Repeated 404 probing detected",
            expires_at=timezone.now() + timedelta(minutes=30),
            active=True,
        )

    def test_user_without_facility_membership_cannot_list_facilities(self):
        self.client.force_authenticate(user=self.outsider)

        response = self.client.get(reverse("facilities"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_facility_member_can_list_visible_facilities(self):
        self.client.force_authenticate(user=self.member)

        response = self.client.get(reverse("facilities"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_ip_is_blocked_after_repeated_404_responses(self):
        self.client.get("/definitely-missing-1/")
        second_response = self.client.get("/definitely-missing-2/")
        blocked_response = self.client.get(reverse("facilities"))

        self.assertEqual(second_response.status_code, 404)
        self.assertEqual(blocked_response.status_code, 403)
        self.assertTrue(BlockedIP.objects.filter(ip_address="127.0.0.1", active=True, trigger_status=404).exists())

    def test_staff_can_list_blocked_ips(self):
        self.client.force_authenticate(user=self.staff)

        response = self.client.get(reverse("blocked-ip-list"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["blocked_ips"]), 1)

    def test_staff_can_unblock_ip(self):
        self.client.force_authenticate(user=self.staff)

        response = self.client.post(reverse("blocked-ip-unblock", kwargs={"block_id": self.block.id}))

        self.assertEqual(response.status_code, 200)
        self.block.refresh_from_db()
        self.assertFalse(self.block.active)

    def test_non_staff_cannot_manage_blocked_ips(self):
        self.client.force_authenticate(user=self.outsider)

        response = self.client.get(reverse("blocked-ip-list"))

        self.assertEqual(response.status_code, 403)
