from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from unittest.mock import patch
from rest_framework.test import APITestCase

from accounts.models import FacilityMembership, Institution, InstitutionMembership
from billing.constants import FEATURE_CHAT_SUPPORT, FEATURE_MAX_CHAT_CONVERSATIONS_PER_MONTH
from billing.models import BillingFeature, InstitutionEntitlementOverride
from billing.services.entitlements import ensure_subscription_for_institution
from incidents.models import Incident
from security.models import SecurityFacility
from utils.hashid import encode_id

from .models import ChatConversation, EmergencyAlert, InstitutionChatWorkspace


class ChatConversationApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="chat-owner", password="pass12345")
        self.facility_member = User.objects.create_user(username="chat-facility", password="pass12345")
        self.outsider = User.objects.create_user(username="chat-outsider", password="pass12345")

        self.institution = Institution.objects.create(name="Chat Institution", owner=self.owner)
        InstitutionMembership.objects.create(institution=self.institution, user=self.owner, role="admin")
        self.facility = SecurityFacility.objects.create(
            name="Chat Station",
            institution=self.institution,
            facility_type="police_station",
            county="Nairobi",
            sub_county="Westlands",
            latitude="-1.286389",
            longitude="36.817223",
        )
        FacilityMembership.objects.create(facility=self.facility, user=self.facility_member, role="member")
        ensure_subscription_for_institution(self.institution)

    def test_facility_member_can_create_conversation_for_their_institution(self):
        self.client.force_authenticate(user=self.facility_member)

        response = self.client.post(
            reverse("chat-conversation-list-create"),
            {
                "institution_id": encode_id(self.institution.id),
                "facility_id": encode_id(self.facility.id),
                "subject": "Need help",
                "customer_name": "Jane Doe",
                "customer_contact": "+254700000000",
                "initial_message": "A suspicious incident was reported.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["conversation"]["customer_name"], "Jane Doe")
        self.assertEqual(len(payload["conversation"]["messages"]), 1)

    def test_outsider_cannot_create_conversation_for_other_institution(self):
        self.client.force_authenticate(user=self.outsider)

        response = self.client.post(
            reverse("chat-conversation-list-create"),
            {"institution_id": encode_id(self.institution.id), "subject": "Unauthorized"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_facility_member_only_sees_conversations_for_their_facility(self):
        other_facility = SecurityFacility.objects.create(
            name="Other Station",
            institution=self.institution,
            facility_type="police_post",
            county="Nairobi",
            sub_county="Dagoretti",
            latitude="-1.300000",
            longitude="36.800000",
        )
        workspace = InstitutionChatWorkspace.objects.create(institution=self.institution)
        visible = ChatConversation.objects.create(workspace=workspace, facility=self.facility, created_by=self.owner)
        hidden = ChatConversation.objects.create(workspace=workspace, facility=other_facility, created_by=self.owner)

        self.client.force_authenticate(user=self.facility_member)
        response = self.client.get(reverse("chat-conversation-list-create"))

        self.assertEqual(response.status_code, 200)
        ids = [item["id"] for item in response.json()]
        self.assertIn(encode_id(visible.id), ids)
        self.assertNotIn(encode_id(hidden.id), ids)

    def test_create_incident_from_chat_links_conversation(self):
        workspace = InstitutionChatWorkspace.objects.create(institution=self.institution)
        conversation = ChatConversation.objects.create(
            workspace=workspace,
            facility=self.facility,
            created_by=self.owner,
            subject="Escalate me",
        )
        self.client.force_authenticate(user=self.facility_member)

        response = self.client.post(
            reverse("chat-conversation-create-incident", args=[encode_id(conversation.id)]),
            {
                "incident_type": "robbery",
                "ob_number": "OB-CHAT-1",
                "description": "Incident created from chat",
                "latitude": "-1.286389",
                "longitude": "36.817223",
                "occurred_at": timezone.now().isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        conversation.refresh_from_db()
        self.assertIsNotNone(conversation.incident_id)
        self.assertEqual(conversation.status, "pending")
        self.assertTrue(Incident.objects.filter(id=conversation.incident_id, facility=self.facility).exists())


class ChatBillingTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="billing-owner", password="pass12345")
        self.institution = Institution.objects.create(name="Billing Chat Inst", owner=self.owner)
        InstitutionMembership.objects.create(institution=self.institution, user=self.owner, role="admin")
        ensure_subscription_for_institution(self.institution)

    def test_chat_feature_exists_and_can_be_overridden(self):
        feature = BillingFeature.objects.get(code=FEATURE_CHAT_SUPPORT)
        InstitutionEntitlementOverride.objects.create(
            institution=self.institution,
            feature=feature,
            is_enabled=False,
        )
        override = self.institution.entitlement_overrides.get(feature=feature)
        self.assertFalse(override.is_enabled)

    def test_chat_usage_feature_exists(self):
        self.assertTrue(BillingFeature.objects.filter(code=FEATURE_MAX_CHAT_CONVERSATIONS_PER_MONTH).exists())


class EmergencyAlertApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="emergency-owner", password="pass12345")
        self.facility_member = User.objects.create_user(username="emergency-facility", password="pass12345")
        self.outsider = User.objects.create_user(username="emergency-outsider", password="pass12345")
        self.staff_operator = User.objects.create_user(
            username="emergency-staff",
            password="pass12345",
            is_staff=True,
        )

        self.institution = Institution.objects.create(name="Emergency Institution", owner=self.owner)
        InstitutionMembership.objects.create(institution=self.institution, user=self.owner, role="admin")
        self.facility = SecurityFacility.objects.create(
            name="Emergency Station",
            institution=self.institution,
            facility_type="police_station",
            county="Nairobi",
            sub_county="Westlands",
            latitude="-1.286389",
            longitude="36.817223",
        )
        FacilityMembership.objects.create(facility=self.facility, user=self.facility_member, role="member")
        self.workspace = InstitutionChatWorkspace.objects.create(institution=self.institution)

    def test_institution_user_can_create_emergency_alert(self):
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(
            reverse("chat-emergency-alert-list-create"),
            {
                "institution_id": encode_id(self.institution.id),
                "facility_id": encode_id(self.facility.id),
                "incident_type": "robbery",
                "summary": "Active robbery in progress near the main gate.",
                "location_label": "Main gate, west entrance",
                "latitude": "-1.286389",
                "longitude": "36.817223",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["status"], "new")
        self.assertEqual(payload["facility_name"], "Emergency Station")
        self.assertTrue(EmergencyAlert.objects.filter(workspace=self.workspace, incident_type="robbery").exists())

    def test_outsider_cannot_create_emergency_alert(self):
        self.client.force_authenticate(user=self.outsider)

        response = self.client.post(
            reverse("chat-emergency-alert-list-create"),
            {
                "institution_id": encode_id(self.institution.id),
                "incident_type": "assault",
                "summary": "Unauthorized attempt",
                "latitude": "-1.286389",
                "longitude": "36.817223",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_facility_member_can_list_alerts_for_their_facility(self):
        alert = EmergencyAlert.objects.create(
            workspace=self.workspace,
            facility=self.facility,
            created_by=self.owner,
            incident_type="accident",
            summary="Vehicle collision outside station",
            latitude="-1.286389",
            longitude="36.817223",
        )

        self.client.force_authenticate(user=self.facility_member)
        response = self.client.get(reverse("chat-emergency-alert-list-create"))

        self.assertEqual(response.status_code, 200)
        ids = [item["id"] for item in response.json()]
        self.assertIn(encode_id(alert.id), ids)

    def test_operator_can_acknowledge_alert_and_leave_notes(self):
        alert = EmergencyAlert.objects.create(
            workspace=self.workspace,
            facility=self.facility,
            created_by=self.owner,
            incident_type="theft",
            summary="Phone snatching reported by patrol team",
            latitude="-1.286389",
            longitude="36.817223",
        )

        self.client.force_authenticate(user=self.staff_operator)
        response = self.client.patch(
            reverse("chat-emergency-alert-detail", args=[encode_id(alert.id)]),
            {"status": "acknowledged", "operator_notes": "Operator has alerted nearest patrol unit."},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        alert.refresh_from_db()
        self.assertEqual(alert.status, "acknowledged")
        self.assertEqual(alert.assigned_operator, self.staff_operator)
        self.assertEqual(alert.operator_notes, "Operator has alerted nearest patrol unit.")
        self.assertIsNotNone(alert.acknowledged_at)


class AdminAssistantApiTests(APITestCase):
    def setUp(self):
        self.super_admin = User.objects.create_user(
            username="root-admin",
            password="pass12345",
            is_staff=True,
            is_superuser=True,
        )
        self.regular_admin = User.objects.create_user(
            username="ops-admin",
            password="pass12345",
            is_staff=True,
        )
        self.owner = User.objects.create_user(username="inst-owner", password="pass12345")

    @patch("chat.views.generate_admin_assistant_plan")
    def test_super_admin_can_execute_create_institution_plan(self, mock_plan):
        mock_plan.return_value = {
            "summary": "Create a new institution.",
            "operator_response": "I created the institution and assigned the owner.",
            "requires_clarification": False,
            "clarification_question": "",
            "actions": [
                {
                    "action_type": "create_institution",
                    "rationale": "The operator explicitly asked for a new institution.",
                    "risk_level": "medium",
                    "parameters": {
                        "name": "North Region Command",
                        "description": "Regional institution",
                        "owner_username": "inst-owner",
                    },
                }
            ],
        }

        self.client.force_authenticate(user=self.super_admin)
        response = self.client.post(
            reverse("chat-admin-assistant"),
            {"message": "Create institution North Region Command for inst-owner"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["results"][0]["status"], "completed")
        self.assertEqual(payload["buttons"][0]["path"], "/institutions")
        self.assertTrue(Institution.objects.filter(name="North Region Command", owner=self.owner).exists())

    @patch("chat.views.generate_admin_assistant_plan")
    def test_non_super_admin_is_blocked_from_admin_assistant(self, mock_plan):
        self.client.force_authenticate(user=self.regular_admin)
        response = self.client.post(
            reverse("chat-admin-assistant"),
            {"message": "List users"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        mock_plan.assert_not_called()

    @patch("chat.views.generate_admin_assistant_plan")
    def test_assistant_returns_clarification_without_execution(self, mock_plan):
        mock_plan.return_value = {
            "summary": "The request is ambiguous.",
            "operator_response": "I need one more detail before I can do that.",
            "requires_clarification": True,
            "clarification_question": "Which user should be promoted to staff?",
            "actions": [],
        }

        self.client.force_authenticate(user=self.super_admin)
        response = self.client.post(
            reverse("chat-admin-assistant"),
            {"message": "Promote the user"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["requires_clarification"])
        self.assertEqual(payload["results"], [])
        self.assertEqual(payload["buttons"][0]["path"], "/admin/users")

    @patch("chat.views.generate_admin_assistant_plan")
    def test_assistant_receives_active_session_history(self, mock_plan):
        mock_plan.return_value = {
            "summary": "Use prior session context.",
            "operator_response": "I used the active session history.",
            "requires_clarification": False,
            "clarification_question": "",
            "actions": [],
        }

        self.client.force_authenticate(user=self.super_admin)
        history = [
            {"role": "operator", "text": "Create Nairobi Central institution for inst-owner"},
            {"role": "assistant", "text": "Institution created."},
            {"role": "operator", "text": "Now add jane as admin there"},
        ]
        response = self.client.post(
            reverse("chat-admin-assistant"),
            {"message": "Promote her now", "history": history},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        mock_plan.assert_called_once_with(
            prompt="Promote her now",
            actor_label=self.super_admin.username,
            history=history,
        )


class CallCenterSuggestionApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="call-owner", password="pass12345", is_staff=True)
        self.institution = Institution.objects.create(name="Call Center Institution", owner=self.owner)
        InstitutionMembership.objects.create(institution=self.institution, user=self.owner, role="admin")
        self.facility = SecurityFacility.objects.create(
            name="Dispatch Desk",
            institution=self.institution,
            facility_type="police_station",
            county="Nairobi",
            sub_county="Westlands",
            latitude="-1.286389",
            longitude="36.817223",
        )
        workspace = InstitutionChatWorkspace.objects.create(institution=self.institution)
        self.conversation = ChatConversation.objects.create(
            workspace=workspace,
            facility=self.facility,
            created_by=self.owner,
            subject="Caller reporting robbery near market",
            customer_name="Jane Doe",
            customer_contact="+254700000001",
        )

    @patch("chat.views.generate_call_center_suggestions")
    def test_authorized_user_can_get_ai_suggestions_for_conversation(self, mock_suggestions):
        mock_suggestions.return_value = {
            "summary": "Escalate this call to an incident and review the facility map.",
            "guidance": "The caller reported an active robbery and gave enough detail for escalation.",
            "buttons": [
                {"label": "Open incidents", "path": "/incidents", "note": "Create or review the incident record."},
                {"label": "Open facility map", "path": "/facilities/map", "note": "Verify nearby facility coverage."},
            ],
        }

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            reverse("chat-conversation-ai-suggestions", args=[encode_id(self.conversation.id)]),
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["buttons"][0]["path"], "/incidents")
        mock_suggestions.assert_called_once()

    @patch("chat.views.generate_call_center_suggestions")
    def test_user_cannot_get_suggestions_for_inaccessible_conversation(self, mock_suggestions):
        outsider = User.objects.create_user(username="call-outsider", password="pass12345")
        self.client.force_authenticate(user=outsider)
        response = self.client.post(
            reverse("chat-conversation-ai-suggestions", args=[encode_id(self.conversation.id)]),
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        mock_suggestions.assert_not_called()

    @patch("chat.views.generate_call_center_reply")
    def test_authorized_user_can_add_assistant_reply_to_conversation(self, mock_reply):
        mock_reply.return_value = {
            "reply": "Based on the caller report, review incidents and the facility map next.",
            "buttons": [
                {"label": "Open incidents", "path": "/incidents", "note": "Review or create the incident."},
                {"label": "Open map", "path": "/facilities/map", "note": "Check nearest facility coverage."},
            ],
        }

        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            reverse("chat-conversation-assistant-reply", args=[encode_id(self.conversation.id)]),
            {"message": "What should I do next?"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["agent_message"]["sender_type"], "agent")
        self.assertEqual(payload["agent_message"]["body"], "What should I do next?")
        self.assertEqual(payload["message"]["sender_type"], "system")
        self.assertEqual(payload["message"]["metadata"]["assistant_buttons"][0]["path"], "/incidents")
