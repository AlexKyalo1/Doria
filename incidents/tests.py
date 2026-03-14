from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import FacilityMembership, Institution
from incidents.models import Incident
from security.models import SecurityFacility
from utils.hashid import encode_id


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


@override_settings(OPENAI_INCIDENT_INSIGHTS_MODEL="test-model")
class IncidentInsightsTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="insights-user", password="pass12345")
        self.institution = Institution.objects.create(name="Insights Institution", owner=self.user)
        self.facility = SecurityFacility.objects.create(
            name="Insights Station",
            institution=self.institution,
            facility_type="police_station",
            county="Nairobi",
            sub_county="Westlands",
            latitude="-1.286389",
            longitude="36.817223",
        )
        FacilityMembership.objects.create(facility=self.facility, user=self.user, role="member")
        Incident.objects.create(
            ob_number="OB-22",
            incident_type="robbery",
            description="Insights test incident",
            facility=self.facility,
            institution=self.institution,
            latitude="-1.286389",
            longitude="36.817223",
            occurred_at=timezone.now() - timedelta(days=1),
        )

    @patch("incidents.views.generate_incident_insights")
    def test_insights_endpoint_returns_ai_payload(self, mock_generate):
        self.client.force_authenticate(user=self.user)
        mock_generate.return_value = {
            "summary": "Test summary",
            "risk_level": "medium",
            "top_patterns": ["Pattern A"],
            "priority_actions": ["Action A"],
            "follow_up_gaps": ["Gap A"],
            "incident_breakdown": [{"incident_type": "robbery", "count": 1}],
            "facility_hotspots": [{"facility_name": "Insights Station", "incident_count": 1}],
            "recommended_queries": ["Query A"],
        }

        response = self.client.post(
            reverse("incident-ai-insights"),
            data={
                "institution_id": encode_id(self.institution.id),
                "incident_type": "robbery",
                "max_records": 10,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["insights"]["summary"], "Test summary")
        self.assertEqual(payload["meta"]["model"], "test-model")
        mock_generate.assert_called_once()

    def test_insights_endpoint_returns_fallback_when_no_incidents(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            reverse("incident-ai-insights"),
            data={"incident_type": "murder"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["meta"]["incident_count"], 0)
        self.assertEqual(payload["insights"]["risk_level"], "low")

    def test_insights_endpoint_rejects_invalid_date(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            reverse("incident-ai-insights"),
            data={"date_from": "not-a-date"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
