from datetime import timedelta

from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import FacilityMembership, Institution
from incidents.models import Incident
from security.models import SecurityFacility


class IncidentVisibilityTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="pass12345")
        self.member = User.objects.create_user(username="member", password="pass12345")
        self.outsider = User.objects.create_user(username="outsider", password="pass12345")

        self.institution = Institution.objects.create(
            name="Test Institution",
            owner=self.owner,
        )
        self.facility = SecurityFacility.objects.create(
            name="Central Station",
            institution=self.institution,
            facility_type="police_station",
            county="Nairobi",
            sub_county="Westlands",
            latitude="-1.286389",
            longitude="36.817223",
        )
        FacilityMembership.objects.create(facility=self.facility, user=self.member, role="member")

        self.incident = Incident.objects.create(
            ob_number="OB-1",
            incident_type="robbery",
            description="Test incident",
            facility=self.facility,
            institution=self.institution,
            latitude="-1.286389",
            longitude="36.817223",
            occurred_at=timezone.now() - timedelta(hours=1),
        )

    def test_user_without_facility_membership_cannot_list_incidents(self):
        self.client.force_authenticate(user=self.outsider)

        response = self.client.get(reverse("incident-list-create"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_user_without_facility_membership_cannot_view_incidents_on_map(self):
        self.client.force_authenticate(user=self.outsider)

        response = self.client.get(reverse("incident-map-data"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_facility_member_can_list_visible_incidents(self):
        self.client.force_authenticate(user=self.member)

        response = self.client.get(reverse("incident-list-create"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
