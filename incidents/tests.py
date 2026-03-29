from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import FacilityMembership, Institution, InstitutionMembership
from billing.models import BillingFeature, InstitutionEntitlementOverride
from incidents.models import Incident, IncidentActivity, IncidentComment, IncidentInstitutionAccess
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

    def test_institution_owner_can_list_incidents_linked_only_through_facility_institution(self):
        incident = Incident.objects.create(
            ob_number="OB-2",
            incident_type="theft",
            description="Facility-linked incident",
            facility=self.facility,
            institution=None,
            latitude="-1.286389",
            longitude="36.817223",
            occurred_at=timezone.now() - timedelta(minutes=30),
        )
        self.client.force_authenticate(user=self.owner)

        response = self.client.get(reverse("incident-list-create"))

        self.assertEqual(response.status_code, 200)
        ids = [item["id"] for item in response.json()]
        self.assertIn(encode_id(incident.id), ids)


class IncidentFollowUpPermissionTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="incident-owner", password="pass12345")
        self.admin = User.objects.create_user(username="incident-admin", password="pass12345")
        self.institution = Institution.objects.create(name="Ops Institution", owner=self.owner)
        InstitutionMembership.objects.create(institution=self.institution, user=self.admin, role="admin")
        self.facility = SecurityFacility.objects.create(
            name="Ops Station",
            institution=self.institution,
            facility_type="police_station",
            county="Nairobi",
            sub_county="Westlands",
            latitude="-1.286389",
            longitude="36.817223",
        )
        self.incident = Incident.objects.create(
            ob_number="OB-3",
            incident_type="assault",
            description="Needs follow-up",
            facility=self.facility,
            institution=None,
            latitude="-1.286389",
            longitude="36.817223",
            occurred_at=timezone.now() - timedelta(hours=2),
        )
        self.incident_hash = encode_id(self.incident.id)

    def test_institution_owner_can_update_incident_in_facility_under_institution(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.patch(
            f"/api/incidents/{self.incident_hash}/",
            {"follow_up_status": "in_progress", "follow_up_note": "Owner updated"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.incident.refresh_from_db()
        self.assertEqual(self.incident.follow_up_status, "in_progress")
        self.assertEqual(self.incident.follow_up_note, "Owner updated")

    def test_incident_created_with_facility_inherits_institution(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            reverse("incident-list-create"),
            {
                "facility": self.facility.id,
                "incident_type": "robbery",
                "ob_number": "OB-4",
                "description": "Created from facility",
                "latitude": "-1.286389",
                "longitude": "36.817223",
                "occurred_at": timezone.now().isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        created = Incident.objects.get(ob_number="OB-4")
        self.assertEqual(created.institution_id, self.institution.id)


class IncidentCollaborationTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="collab-owner", password="pass12345")
        self.partner_owner = User.objects.create_user(username="partner-owner", password="pass12345")
        self.partner_member = User.objects.create_user(username="partner-member", password="pass12345")

        self.home_institution = Institution.objects.create(name="Home Institution", owner=self.owner)
        self.partner_institution = Institution.objects.create(name="Partner Institution", owner=self.partner_owner)
        InstitutionMembership.objects.create(
            institution=self.partner_institution,
            user=self.partner_member,
            role="member",
        )

        self.facility = SecurityFacility.objects.create(
            name="Home Station",
            institution=self.home_institution,
            facility_type="police_station",
            county="Nairobi",
            sub_county="Westlands",
            latitude="-1.286389",
            longitude="36.817223",
        )
        self.incident = Incident.objects.create(
            ob_number="OB-COLLAB",
            incident_type="theft",
            description="Cross-institution case",
            facility=self.facility,
            institution=self.home_institution,
            latitude="-1.286389",
            longitude="36.817223",
            occurred_at=timezone.now() - timedelta(hours=4),
        )
        self.incident_hash = encode_id(self.incident.id)
        self.partner_institution_hash = encode_id(self.partner_institution.id)

    def test_owner_can_share_incident_with_partner_institution(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            reverse("incident-collaboration-add", kwargs={"pk": self.incident_hash}),
            {"institution_id": self.partner_institution_hash, "access_level": "contributor"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            IncidentInstitutionAccess.objects.filter(
                incident=self.incident,
                institution=self.partner_institution,
                access_level="contributor",
            ).exists()
        )
        self.assertTrue(
            IncidentActivity.objects.filter(
                incident=self.incident,
                action_type="institution_shared",
            ).exists()
        )

    def test_shared_institution_member_can_list_incident(self):
        IncidentInstitutionAccess.objects.create(
            incident=self.incident,
            institution=self.partner_institution,
            access_level="contributor",
            shared_by=self.owner,
        )
        self.client.force_authenticate(user=self.partner_member)

        response = self.client.get(reverse("incident-list-create"))

        self.assertEqual(response.status_code, 200)
        ids = [item["id"] for item in response.json()]
        self.assertIn(self.incident_hash, ids)

    def test_shared_contributor_can_comment_and_generate_activity(self):
        IncidentInstitutionAccess.objects.create(
            incident=self.incident,
            institution=self.partner_institution,
            access_level="contributor",
            shared_by=self.owner,
        )
        self.client.force_authenticate(user=self.partner_member)

        response = self.client.post(
            reverse("incident-comment-create", kwargs={"pk": self.incident_hash}),
            {"body": "Partner institution has assigned a liaison officer."},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            IncidentComment.objects.filter(
                incident=self.incident,
                created_by=self.partner_member,
            ).exists()
        )
        self.assertTrue(
            IncidentActivity.objects.filter(
                incident=self.incident,
                action_type="comment_added",
            ).exists()
        )


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
        ai_feature = BillingFeature.objects.get(code="ai_insights")
        ai_quota_feature = BillingFeature.objects.get(code="max_ai_queries_per_month")
        InstitutionEntitlementOverride.objects.create(
            institution=self.institution,
            feature=ai_feature,
            is_enabled=True,
        )
        InstitutionEntitlementOverride.objects.create(
            institution=self.institution,
            feature=ai_quota_feature,
            limit_value=10,
        )
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


class PublicIncidentReportTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="public-owner", password="pass12345")
        self.institution = Institution.objects.create(name="Public Match Institution", owner=self.owner)
        self.facility = SecurityFacility.objects.create(
            name="Public Match Station",
            institution=self.institution,
            facility_type="police_station",
            county="Nairobi",
            sub_county="Westlands",
            latitude="-1.286389",
            longitude="36.817223",
        )

    @patch("incidents.views.generate_public_incident_match")
    def test_public_report_creates_incident_when_match_found(self, mock_match):
        mock_match.return_value = {
            "match_found": True,
            "institution_id": self.institution.id,
            "facility_id": self.facility.id,
            "confidence": "high",
            "reason": "Nearest facility and county match.",
            "public_message": "Your report has been routed to Public Match Institution.",
        }

        response = self.client.post(
            reverse("incident-public-report"),
            {
                "reporter_name": "Jane Reporter",
                "reporter_contact": "+254700000001",
                "incident_type": "robbery",
                "description": "Robbery reported near Westlands roundabout.",
                "public_location_hint": "Westlands, Nairobi",
                "latitude": "-1.286389",
                "longitude": "36.817223",
                "occurred_at": timezone.now().isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertTrue(payload["matched"])
        incident = Incident.objects.get(ob_number=payload["incident"]["reference"])
        self.assertEqual(incident.institution, self.institution)
        self.assertEqual(incident.facility, self.facility)
        self.assertEqual(incident.source, "public")
        self.assertEqual(incident.reporter_name, "Jane Reporter")

    @patch("incidents.views.generate_public_incident_match")
    def test_public_report_returns_no_match_message(self, mock_match):
        mock_match.return_value = {
            "match_found": False,
            "institution_id": None,
            "facility_id": None,
            "confidence": "low",
            "reason": "No suitable institution candidate.",
            "public_message": "We could not match this report to an institution in the platform.",
        }

        response = self.client.post(
            reverse("incident-public-report"),
            {
                "incident_type": "theft",
                "description": "Phone stolen in an unrecognized area.",
                "public_location_hint": "Unknown area",
                "latitude": "-0.100000",
                "longitude": "37.100000",
                "occurred_at": timezone.now().isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertFalse(payload["matched"])
        self.assertEqual(Incident.objects.count(), 0)

    @patch("incidents.views.generate_public_incident_match")
    def test_public_report_requires_relevant_facility_before_creating_incident(self, mock_match):
        mock_match.return_value = {
            "match_found": True,
            "institution_id": self.institution.id,
            "facility_id": None,
            "confidence": "medium",
            "reason": "Institution matched but no facility was confident enough.",
            "public_message": "Institution matched without a confident facility.",
        }

        response = self.client.post(
            reverse("incident-public-report"),
            {
                "incident_type": "theft",
                "description": "Possible theft near an unclear location.",
                "public_location_hint": "Nairobi",
                "latitude": "-1.286389",
                "longitude": "36.817223",
                "occurred_at": timezone.now().isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertFalse(payload["matched"])
        self.assertEqual(Incident.objects.count(), 0)

    @patch("incidents.views.generate_public_incident_match")
    @patch("incidents.views.analyze_public_incident_image")
    def test_public_report_can_use_ai_image_extraction(self, mock_analyze_image, mock_match):
        mock_analyze_image.return_value = {
            "incident_type": "robbery",
            "description": "A crowd appears to be chasing a suspect outside a shopfront.",
            "location_hint": "Westlands Nairobi",
            "visible_signals": ["crowd", "shopfront"],
        }
        mock_match.return_value = {
            "match_found": True,
            "institution_id": self.institution.id,
            "facility_id": self.facility.id,
            "confidence": "high",
            "reason": "Image-derived hint matched the nearest facility.",
            "public_message": "Your report has been routed to Public Match Institution.",
        }

        image = SimpleUploadedFile("incident.jpg", b"fake-image-content", content_type="image/jpeg")
        response = self.client.post(
            reverse("incident-public-report"),
            {
                "public_location_hint": "Westlands Nairobi",
                "occurred_at": timezone.now().isoformat(),
                "image": image,
            },
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertTrue(payload["matched"])
        self.assertEqual(payload["analysis"]["incident_type"], "robbery")


@override_settings(OPENAI_API_KEY="")
class IncidentAreaIntelligenceTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="area-owner", password="pass12345")
        self.staff = User.objects.create_user(username="area-staff", password="pass12345", is_staff=True, is_superuser=True)
        self.outsider = User.objects.create_user(username="area-outsider", password="pass12345")
        self.institution = Institution.objects.create(name="Area Institution", owner=self.owner)
        self.facility = SecurityFacility.objects.create(
            name="Area Station",
            institution=self.institution,
            facility_type="police_station",
            county="Nairobi",
            sub_county="Westlands",
            latitude="-1.286389",
            longitude="36.817223",
        )
        Incident.objects.create(
            ob_number="OB-AREA",
            incident_type="robbery",
            description="Area analysis test incident",
            facility=self.facility,
            institution=self.institution,
            latitude="-1.286389",
            longitude="36.817223",
            occurred_at=timezone.now() - timedelta(hours=3),
        )

    @patch("incidents.views.fetch_area_news")
    def test_institution_owner_can_run_area_analysis(self, mock_area_news):
        self.client.force_authenticate(user=self.owner)
        mock_area_news.return_value = {
            "query": "security Westlands Nairobi",
            "articles": [],
        }

        response = self.client.post(
            reverse("incident-area-analysis"),
            data={
                "institution_id": encode_id(self.institution.id),
                "center_latitude": "-1.286389",
                "center_longitude": "36.817223",
                "radius_km": 2,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["counts"]["facilities"], 1)
        self.assertEqual(payload["counts"]["incidents"], 1)
        self.assertTrue(payload["meta"]["used_fallback"])
        self.assertEqual(payload["live_intel"]["query"], "security Westlands Nairobi")

    def test_staff_can_switch_institutions_for_area_analysis(self):
        self.client.force_authenticate(user=self.staff)

        response = self.client.post(
            reverse("incident-area-analysis"),
            data={
                "institution_id": encode_id(self.institution.id),
                "center_latitude": "-1.286389",
                "center_longitude": "36.817223",
                "radius_km": 2,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["institution"]["name"], "Area Institution")

    def test_outsider_cannot_run_area_analysis(self):
        self.client.force_authenticate(user=self.outsider)

        response = self.client.post(
            reverse("incident-area-analysis"),
            data={
                "center_latitude": "-1.286389",
                "center_longitude": "36.817223",
                "radius_km": 2,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)


class IncidentNewsLinksTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="news-owner", password="pass12345")
        self.outsider = User.objects.create_user(username="news-outsider", password="pass12345")
        self.institution = Institution.objects.create(name="News Institution", owner=self.owner)
        self.facility = SecurityFacility.objects.create(
            name="News Station",
            institution=self.institution,
            facility_type="police_station",
            county="Nairobi",
            sub_county="Westlands",
            latitude="-1.286389",
            longitude="36.817223",
        )
        self.incident = Incident.objects.create(
            ob_number="OB-NEWS",
            incident_type="robbery",
            description="News lookup incident",
            facility=self.facility,
            institution=self.institution,
            latitude="-1.286389",
            longitude="36.817223",
            occurred_at=timezone.now() - timedelta(hours=5),
        )

    @patch("incidents.views.fetch_incident_news")
    def test_authorized_user_can_get_news_links(self, mock_fetch_news):
        self.client.force_authenticate(user=self.owner)
        mock_fetch_news.return_value = {
            "query": "robbery Nairobi Kenya",
            "articles": [
                {
                    "title": "Sample robbery story",
                    "link": "https://example.com/story",
                    "source": "Example News",
                    "published_at": timezone.now().isoformat(),
                    "matching_signal": "High match",
                }
            ],
        }

        response = self.client.post(
            reverse("incident-news-links", kwargs={"pk": encode_id(self.incident.id)}),
            data={"limit": 3},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["articles"][0]["source"], "Example News")

    def test_outsider_cannot_get_news_links(self):
        self.client.force_authenticate(user=self.outsider)

        response = self.client.post(
            reverse("incident-news-links", kwargs={"pk": encode_id(self.incident.id)}),
            data={"limit": 3},
            format="json",
        )

        self.assertEqual(response.status_code, 404)


class PublicIncidentInquiryTests(APITestCase):
    def setUp(self):
        owner = User.objects.create_user(username="inquiry-owner", password="pass12345")
        institution = Institution.objects.create(name="Inquiry Institution", owner=owner)
        facility = SecurityFacility.objects.create(
            name="Inquiry Station",
            institution=institution,
            facility_type="police_station",
            county="Nairobi",
            sub_county="Westlands",
            latitude="-1.286389",
            longitude="36.817223",
        )
        self.incident = Incident.objects.create(
            ob_number="PUB-20260329010101",
            incident_type="robbery",
            description="Reporter inquiry case",
            facility=facility,
            institution=institution,
            latitude="-1.286389",
            longitude="36.817223",
            occurred_at=timezone.now() - timedelta(hours=2),
            source=Incident.SOURCE_PUBLIC,
            reporter_name="Inquiry Reporter",
            reporter_contact="+254 700 111 222",
            public_location_hint="Westlands, Nairobi",
            follow_up_status="in_progress",
        )
        Incident.objects.create(
            ob_number="PUB-20260329010102",
            incident_type="robbery",
            description="Nearby recent public incident",
            facility=facility,
            institution=institution,
            latitude="-1.286390",
            longitude="36.817224",
            occurred_at=timezone.now() - timedelta(hours=1),
            source=Incident.SOURCE_PUBLIC,
            reporter_contact="+254700333444",
            public_location_hint="Westlands, Nairobi",
        )

    @patch("incidents.views.fetch_area_news")
    def test_public_inquiry_returns_incident_for_matching_contact(self, mock_area_news):
        mock_area_news.return_value = {
            "query": "robbery security Westlands Nairobi",
            "articles": [],
        }
        response = self.client.post(
            reverse("incident-public-inquiry"),
            {
                "reference": "PUB-20260329010101",
                "reporter_contact": "+254700111222",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["found"])
        self.assertEqual(payload["incident"]["reference"], "PUB-20260329010101")
        self.assertEqual(payload["incident"]["status"], "in_progress")
        self.assertEqual(len(payload["nearby_recent_incidents"]), 1)
        self.assertEqual(payload["live_intel"]["query"], "robbery security Westlands Nairobi")

    def test_public_inquiry_rejects_wrong_contact(self):
        response = self.client.post(
            reverse("incident-public-inquiry"),
            {
                "reference": "PUB-20260329010101",
                "reporter_contact": "+254799999999",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 404)
        self.assertFalse(response.json()["found"])
