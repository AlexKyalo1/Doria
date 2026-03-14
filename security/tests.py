from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import FacilityMembership, Institution
from security.models import SecurityFacility


class FacilityVisibilityTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner2", password="pass12345")
        self.member = User.objects.create_user(username="member2", password="pass12345")
        self.outsider = User.objects.create_user(username="outsider2", password="pass12345")

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
