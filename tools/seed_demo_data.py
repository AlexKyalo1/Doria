import os
import sys
from pathlib import Path
from decimal import Decimal

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "doria.settings")

import django

django.setup()

from django.contrib.auth.models import User
from django.core.management import call_command
from django.utils import timezone

from accounts.models import FacilityMembership, Institution, InstitutionMembership
from billing.constants import (
    DEFAULT_FREE_PLAN_CODE,
    FEATURE_AI_INSIGHTS,
    FEATURE_CHAT_SUPPORT,
    FEATURE_MAX_AI_QUERIES_PER_MONTH,
    FEATURE_MAX_CHAT_CONVERSATIONS_PER_MONTH,
    FEATURE_MAX_FACILITIES,
    FEATURE_MAX_MEMBERS,
    SUBSCRIPTION_STATUS_ACTIVE,
)
from billing.models import BillingFeature, BillingPlan, InstitutionSubscription, PlanEntitlement
from chat.models import ChatConversation, ChatMessage, EmergencyAlert, InstitutionChatWorkspace
from incidents.models import (
    Incident,
    IncidentActivity,
    IncidentComment,
    IncidentInstitutionAccess,
    IncidentUpdate,
)
from security.models import SecurityFacility


PASSWORD = "DemoPass123!"
now = timezone.now()


def dec(value):
    return Decimal(str(value))


def bootstrap_billing():
    features = {
        FEATURE_AI_INSIGHTS: ("AI Insights", "Enable AI-assisted insights", "boolean", True, None),
        FEATURE_CHAT_SUPPORT: ("Chat Support", "Enable chat and call-center tools", "boolean", True, None),
        FEATURE_MAX_AI_QUERIES_PER_MONTH: ("Max AI Queries", "Monthly AI quota", "limit", None, 500),
        FEATURE_MAX_CHAT_CONVERSATIONS_PER_MONTH: ("Max Chat Conversations", "Monthly chat quota", "limit", None, 1000),
        FEATURE_MAX_FACILITIES: ("Max Facilities", "Facility limit per institution", "limit", None, 50),
        FEATURE_MAX_MEMBERS: ("Max Members", "Member limit per institution", "limit", None, 250),
    }

    feature_objects = {}
    for code, (name, description, value_type, is_enabled, limit_value) in features.items():
        feature_objects[code], _ = BillingFeature.objects.get_or_create(
            code=code,
            defaults={
                "name": name,
                "description": description,
                "value_type": value_type,
            },
        )

    plans = [
        {
            "code": DEFAULT_FREE_PLAN_CODE,
            "name": "Free",
            "description": "Baseline demo access",
            "price_amount": dec("0.00"),
        },
        {
            "code": "ops_pro",
            "name": "Operations Pro",
            "description": "Expanded collaboration and AI tooling",
            "price_amount": dec("24999.00"),
        },
        {
            "code": "enterprise_demo",
            "name": "Enterprise Demo",
            "description": "Full demo access for presentations",
            "price_amount": dec("0.00"),
        },
    ]

    plan_objects = {}
    for plan_data in plans:
        plan_objects[plan_data["code"]], _ = BillingPlan.objects.get_or_create(
            code=plan_data["code"],
            defaults={
                "name": plan_data["name"],
                "description": plan_data["description"],
                "price_amount": plan_data["price_amount"],
                "currency": "kes",
                "billing_interval": "month",
                "is_active": True,
            },
        )

    enterprise_plan = plan_objects["enterprise_demo"]
    for code, (_, _, _, is_enabled, limit_value) in features.items():
        PlanEntitlement.objects.update_or_create(
            plan=enterprise_plan,
            feature=feature_objects[code],
            defaults={"is_enabled": is_enabled, "limit_value": limit_value},
        )

    free_plan = plan_objects[DEFAULT_FREE_PLAN_CODE]
    free_defaults = {
        FEATURE_AI_INSIGHTS: (True, None),
        FEATURE_CHAT_SUPPORT: (True, None),
        FEATURE_MAX_AI_QUERIES_PER_MONTH: (None, 100),
        FEATURE_MAX_CHAT_CONVERSATIONS_PER_MONTH: (None, 150),
        FEATURE_MAX_FACILITIES: (None, 15),
        FEATURE_MAX_MEMBERS: (None, 60),
    }
    for code, (is_enabled, limit_value) in free_defaults.items():
        PlanEntitlement.objects.update_or_create(
            plan=free_plan,
            feature=feature_objects[code],
            defaults={"is_enabled": is_enabled, "limit_value": limit_value},
        )

    return plan_objects


def create_user(username, first_name, last_name, email, *, is_staff=False, is_superuser=False):
    user = User.objects.create_user(
        username=username,
        password=PASSWORD,
        email=email,
        first_name=first_name,
        last_name=last_name,
        is_staff=is_staff,
        is_superuser=is_superuser,
        is_active=True,
    )
    return user


def create_institution(name, description, owner, members, facilities, plan):
    institution = Institution.objects.create(name=name, description=description, owner=owner)
    InstitutionMembership.objects.create(institution=institution, user=owner, role="admin")
    for user, role in members:
        InstitutionMembership.objects.create(institution=institution, user=user, role=role)

    InstitutionSubscription.objects.create(
        institution=institution,
        plan=plan,
        status=SUBSCRIPTION_STATUS_ACTIVE,
        provider="manual",
        current_period_start=now,
        current_period_end=now + timezone.timedelta(days=30),
    )

    created_facilities = []
    for facility in facilities:
        record = SecurityFacility.objects.create(
            institution=institution,
            name=facility["name"],
            facility_type=facility["facility_type"],
            county=facility["county"],
            sub_county=facility["sub_county"],
            latitude=dec(facility["latitude"]),
            longitude=dec(facility["longitude"]),
            active=True,
        )
        created_facilities.append(record)
        for user, role in facility.get("members", []):
            FacilityMembership.objects.create(facility=record, user=user, role=role)

    workspace = InstitutionChatWorkspace.objects.create(institution=institution, is_enabled=True, allow_incident_creation=True)
    return institution, created_facilities, workspace


def add_incident(*, institution, facility, created_by, ob_number, incident_type, description, latitude, longitude, hours_ago, status, note):
    incident = Incident.objects.create(
        ob_number=ob_number,
        incident_type=incident_type,
        description=description,
        facility=facility,
        institution=institution,
        latitude=dec(latitude),
        longitude=dec(longitude),
        occurred_at=now - timezone.timedelta(hours=hours_ago),
        follow_up_status=status,
        follow_up_note=note,
        follow_up_by=created_by,
        follow_up_at=now - timezone.timedelta(hours=max(hours_ago - 1, 0)),
        source=Incident.SOURCE_INTERNAL,
    )

    IncidentUpdate.objects.create(
        incident=incident,
        status=status,
        note=note,
        action_taken="Initial response logged for demo",
        assigned_to_name=created_by.get_full_name() or created_by.username,
        next_step="Continue field coordination",
        due_at=now + timezone.timedelta(hours=6),
        created_by=created_by,
    )

    IncidentComment.objects.create(
        incident=incident,
        body="Coordination note added for cross-agency visibility.",
        created_by=created_by,
        actor_institution=institution,
        actor_facility=facility,
    )

    IncidentActivity.objects.create(
        incident=incident,
        actor=created_by,
        actor_institution=institution,
        actor_facility=facility,
        action_type=IncidentActivity.ACTION_UPDATE_ADDED,
        summary="Initial incident update recorded",
        metadata={"demo": True},
    )
    return incident


def add_conversation(workspace, facility, created_by, subject, customer_name, customer_contact, messages, incident=None, status="open"):
    conversation = ChatConversation.objects.create(
        workspace=workspace,
        facility=facility,
        incident=incident,
        status=status,
        source=ChatConversation.SOURCE_WEB,
        subject=subject,
        customer_name=customer_name,
        customer_contact=customer_contact,
        created_by=created_by,
        assigned_agent=created_by,
    )
    for sender_type, body, sender_user in messages:
        ChatMessage.objects.create(
            conversation=conversation,
            sender_type=sender_type,
            body=body,
            sender_user=sender_user,
        )
    return conversation


def add_emergency_alert(workspace, facility, created_by, operator, incident_type, summary, location_label, latitude, longitude, status, incident=None):
    alert = EmergencyAlert.objects.create(
        workspace=workspace,
        facility=facility,
        incident=incident,
        created_by=created_by,
        assigned_operator=operator,
        incident_type=incident_type,
        summary=summary,
        location_label=location_label,
        latitude=dec(latitude),
        longitude=dec(longitude),
        status=status,
        operator_notes="Demo dispatch workflow in progress." if operator else "",
        acknowledged_at=now if status in {"acknowledged", "dispatched", "resolved"} else None,
        resolved_at=now if status == "resolved" else None,
    )
    return alert


def main():
    call_command("flush", interactive=False, verbosity=0)
    plans = bootstrap_billing()
    demo_plan = plans["enterprise_demo"]

    root = create_user("demo_root", "Demo", "Root", "root@doria.demo", is_staff=True, is_superuser=True)
    ops_admin = create_user("ops_admin", "Amina", "Mwangi", "amina.mwangi@doria.demo", is_staff=True)
    call_lead = create_user("call_lead", "Brian", "Otieno", "brian.otieno@doria.demo", is_staff=True)
    security_admin = create_user("security_admin", "Faith", "Kariuki", "faith.kariuki@doria.demo", is_staff=True)

    nps_owner = create_user("nps_commander", "Gilbert", "Kiptoo", "gilbert.kiptoo@nps.demo")
    nps_admin = create_user("nps_admin", "Rose", "Njeri", "rose.njeri@nps.demo")
    nps_member = create_user("nps_ops", "Kevin", "Musyoka", "kevin.musyoka@nps.demo")

    kplc_owner = create_user("kplc_director", "Lilian", "Achieng", "lilian.achieng@kplc.demo")
    kplc_admin = create_user("kplc_admin", "Samuel", "Waweru", "samuel.waweru@kplc.demo")
    kplc_member = create_user("kplc_ops", "Mercy", "Atieno", "mercy.atieno@kplc.demo")

    kpc_owner = create_user("kpc_director", "David", "Mutua", "david.mutua@kpc.demo")
    kpc_admin = create_user("kpc_admin", "Janet", "Chebet", "janet.chebet@kpc.demo")
    kpc_member = create_user("kpc_ops", "Peter", "Odhiambo", "peter.odhiambo@kpc.demo")

    kpa_owner = create_user("kpa_director", "Ali", "Bakari", "ali.bakari@kpa.demo")
    kpa_admin = create_user("kpa_admin", "Martha", "Wanjiru", "martha.wanjiru@kpa.demo")

    krc_owner = create_user("krc_director", "Joseph", "Muriithi", "joseph.muriithi@krc.demo")
    kws_owner = create_user("kws_director", "Naomi", "Lenaola", "naomi.lenaola@kws.demo")

    nps, nps_facilities, nps_workspace = create_institution(
        "National Police Service",
        "Kenya's national policing institution demo tenant.",
        nps_owner,
        [(nps_admin, "admin"), (nps_member, "member"), (ops_admin, "admin"), (call_lead, "member")],
        [
            {
                "name": "Nairobi Central Police Station",
                "facility_type": "police_station",
                "county": "Nairobi",
                "sub_county": "Starehe",
                "latitude": -1.286389,
                "longitude": 36.817223,
                "members": [(nps_admin, "admin"), (nps_member, "member"), (call_lead, "admin")],
            },
            {
                "name": "Westlands Police Post",
                "facility_type": "police_post",
                "county": "Nairobi",
                "sub_county": "Westlands",
                "latitude": -1.267500,
                "longitude": 36.810800,
                "members": [(nps_member, "admin")],
            },
            {
                "name": "DCI Headquarters",
                "facility_type": "dci",
                "county": "Nairobi",
                "sub_county": "Kilimani",
                "latitude": -1.292100,
                "longitude": 36.804900,
                "members": [(security_admin, "admin")],
            },
        ],
        demo_plan,
    )

    kplc, kplc_facilities, kplc_workspace = create_institution(
        "Kenya Power and Lighting Company",
        "Demo utility operations tenant for outage and infrastructure response.",
        kplc_owner,
        [(kplc_admin, "admin"), (kplc_member, "member"), (ops_admin, "admin")],
        [
            {
                "name": "Stima Plaza HQ",
                "facility_type": "administration",
                "county": "Nairobi",
                "sub_county": "Parklands",
                "latitude": -1.261700,
                "longitude": 36.804400,
                "members": [(kplc_admin, "admin"), (kplc_member, "member")],
            },
            {
                "name": "Industrial Area Grid Office",
                "facility_type": "administration",
                "county": "Nairobi",
                "sub_county": "Makadara",
                "latitude": -1.307600,
                "longitude": 36.850400,
                "members": [(kplc_member, "admin")],
            },
        ],
        demo_plan,
    )

    kpc, kpc_facilities, kpc_workspace = create_institution(
        "Kenya Pipeline Company",
        "Demo energy logistics tenant for pipeline corridor operations.",
        kpc_owner,
        [(kpc_admin, "admin"), (kpc_member, "member"), (security_admin, "admin")],
        [
            {
                "name": "Kenpipe Plaza",
                "facility_type": "administration",
                "county": "Nairobi",
                "sub_county": "Upper Hill",
                "latitude": -1.300900,
                "longitude": 36.816700,
                "members": [(kpc_admin, "admin"), (kpc_member, "member")],
            },
            {
                "name": "Embakasi Dispatch Yard",
                "facility_type": "administration",
                "county": "Nairobi",
                "sub_county": "Embakasi South",
                "latitude": -1.319800,
                "longitude": 36.898400,
                "members": [(kpc_member, "admin")],
            },
        ],
        demo_plan,
    )

    kpa, _, _ = create_institution(
        "Kenya Ports Authority",
        "Demo maritime operations tenant centered on Mombasa port security.",
        kpa_owner,
        [(kpa_admin, "admin"), (ops_admin, "admin")],
        [
            {
                "name": "Port of Mombasa Control Centre",
                "facility_type": "administration",
                "county": "Mombasa",
                "sub_county": "Mvita",
                "latitude": -4.043500,
                "longitude": 39.668200,
                "members": [(kpa_admin, "admin")],
            }
        ],
        demo_plan,
    )

    krc, _, _ = create_institution(
        "Kenya Railways Corporation",
        "Demo rail corridor operations tenant.",
        krc_owner,
        [(ops_admin, "admin")],
        [
            {
                "name": "Syokimau Rail Operations Centre",
                "facility_type": "administration",
                "county": "Machakos",
                "sub_county": "Athi River",
                "latitude": -1.372100,
                "longitude": 36.922700,
                "members": [],
            }
        ],
        demo_plan,
    )

    kws, _, _ = create_institution(
        "Kenya Wildlife Service",
        "Demo conservation and ranger coordination tenant.",
        kws_owner,
        [(security_admin, "admin")],
        [
            {
                "name": "KWS Nairobi HQ",
                "facility_type": "administration",
                "county": "Nairobi",
                "sub_county": "Langata",
                "latitude": -1.373300,
                "longitude": 36.743700,
                "members": [],
            }
        ],
        demo_plan,
    )

    incident_1 = add_incident(
        institution=nps,
        facility=nps_facilities[0],
        created_by=nps_admin,
        ob_number="OB-NPS-001",
        incident_type="robbery",
        description="Armed robbery reported near Kencom stage with two suspects fleeing on a motorcycle.",
        latitude=-1.284900,
        longitude=36.821900,
        hours_ago=4,
        status="in_progress",
        note="Patrol unit dispatched and CCTV review requested.",
    )
    incident_2 = add_incident(
        institution=kplc,
        facility=kplc_facilities[1],
        created_by=kplc_admin,
        ob_number="OB-KPLC-014",
        incident_type="accident",
        description="Transformer fire reported near Enterprise Road causing an area outage.",
        latitude=-1.310600,
        longitude=36.856800,
        hours_ago=8,
        status="open",
        note="Technical response team assembling and public safety cordon requested.",
    )
    incident_3 = add_incident(
        institution=kpc,
        facility=kpc_facilities[1],
        created_by=kpc_admin,
        ob_number="OB-KPC-007",
        incident_type="theft",
        description="Attempted fuel siphoning detected along the Embakasi corridor perimeter.",
        latitude=-1.322100,
        longitude=36.900200,
        hours_ago=10,
        status="resolved",
        note="Suspects dispersed and site integrity confirmed.",
    )

    IncidentInstitutionAccess.objects.create(
        incident=incident_1,
        institution=kplc,
        access_level=IncidentInstitutionAccess.ACCESS_CONTRIBUTOR,
        shared_by=nps_admin,
    )
    IncidentInstitutionAccess.objects.create(
        incident=incident_2,
        institution=nps,
        access_level=IncidentInstitutionAccess.ACCESS_LEAD,
        shared_by=kplc_admin,
    )

    add_conversation(
        nps_workspace,
        nps_facilities[0],
        call_lead,
        "Caller reports armed robbery near city centre",
        "Janet M.",
        "+254700111222",
        [
            ("agent", "Call logged from the city centre. Gathering exact landmark.", call_lead),
            ("system", "AI suggests escalating to incident management and reviewing facility map.", None),
        ],
        incident=incident_1,
        status="pending",
    )
    add_conversation(
        kplc_workspace,
        kplc_facilities[1],
        ops_admin,
        "Power outage and smoke from transformer",
        "Peter K.",
        "+254711333444",
        [
            ("agent", "Caller confirms sparks and loud bang before outage.", ops_admin),
            ("system", "AI suggests creating incident and opening facility map.", None),
        ],
        incident=incident_2,
        status="open",
    )

    add_emergency_alert(
        nps_workspace,
        nps_facilities[1],
        nps_member,
        call_lead,
        "robbery",
        "Patrol team requests immediate backup near Westlands roundabout.",
        "Westlands roundabout",
        -1.267800,
        36.805600,
        "dispatched",
        incident=incident_1,
    )
    add_emergency_alert(
        kplc_workspace,
        kplc_facilities[0],
        kplc_admin,
        ops_admin,
        "accident",
        "High-voltage incident reported at Stima Plaza loading bay.",
        "Stima Plaza rear loading bay",
        -1.261100,
        36.803900,
        "acknowledged",
        incident=incident_2,
    )

    print("Demo data seeded successfully.")
    print(f"Password for all demo users: {PASSWORD}")
    print("Users:")
    for username in [
        "demo_root",
        "ops_admin",
        "call_lead",
        "security_admin",
        "nps_commander",
        "nps_admin",
        "nps_ops",
        "kplc_director",
        "kplc_admin",
        "kplc_ops",
        "kpc_director",
        "kpc_admin",
        "kpc_ops",
        "kpa_director",
        "kpa_admin",
        "krc_director",
        "kws_director",
    ]:
        print(f" - {username}")


if __name__ == "__main__":
    main()
