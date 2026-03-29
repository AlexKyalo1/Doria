from django.conf import settings
from django.db import migrations


INSTITUTION_SEEDS = [
    {
        "name": "Affordable Housing Delivery Programme",
        "description": (
            "Seeded institution aligned to the affordable housing pillar of Kenya's "
            "Bottom-Up Economic Transformation Agenda."
        ),
        "projects": [
            {
                "name": "Ngara Affordable Housing Project",
                "county": "Nairobi",
                "sub_county": "Starehe",
                "latitude": "-1.272600",
                "longitude": "36.821900",
            },
            {
                "name": "Buxton Housing Project",
                "county": "Mombasa",
                "sub_county": "Mvita",
                "latitude": "-4.043500",
                "longitude": "39.668200",
            },
            {
                "name": "Bondeni Affordable Housing Project",
                "county": "Nakuru",
                "sub_county": "Nakuru Town East",
                "latitude": "-0.283300",
                "longitude": "36.066700",
            },
        ],
    },
    {
        "name": "Universal Healthcare Coordination Unit",
        "description": (
            "Seeded institution aligned to the universal healthcare pillar of Kenya's "
            "Bottom-Up Economic Transformation Agenda."
        ),
        "projects": [
            {
                "name": "Kisumu Community Health Hub",
                "county": "Kisumu",
                "sub_county": "Kisumu Central",
                "latitude": "-0.091700",
                "longitude": "34.768000",
            },
            {
                "name": "Eldoret Primary Care Network",
                "county": "Uasin Gishu",
                "sub_county": "Kapseret",
                "latitude": "0.514300",
                "longitude": "35.269800",
            },
            {
                "name": "Garissa Regional Health Response Centre",
                "county": "Garissa",
                "sub_county": "Garissa Township",
                "latitude": "-0.456900",
                "longitude": "39.658300",
            },
        ],
    },
    {
        "name": "Agricultural Value Chain Coordination Agency",
        "description": (
            "Seeded institution aligned to the agriculture and value chain pillar of Kenya's "
            "Bottom-Up Economic Transformation Agenda."
        ),
        "projects": [
            {
                "name": "Mwea Irrigation Coordination Office",
                "county": "Kirinyaga",
                "sub_county": "Mwea East",
                "latitude": "-0.632300",
                "longitude": "37.357700",
            },
            {
                "name": "Nakuru Grain Logistics Hub",
                "county": "Nakuru",
                "sub_county": "Nakuru Town West",
                "latitude": "-0.303100",
                "longitude": "36.080000",
            },
            {
                "name": "Kitale Produce Aggregation Centre",
                "county": "Trans Nzoia",
                "sub_county": "Kiminini",
                "latitude": "1.016700",
                "longitude": "35.000000",
            },
        ],
    },
    {
        "name": "MSME and Cooperative Development Agency",
        "description": (
            "Seeded institution aligned to the MSME economy pillar of Kenya's "
            "Bottom-Up Economic Transformation Agenda."
        ),
        "projects": [
            {
                "name": "Gikomba SME Support Centre",
                "county": "Nairobi",
                "sub_county": "Kamukunji",
                "latitude": "-1.283100",
                "longitude": "36.842100",
            },
            {
                "name": "Nyeri Cooperative Growth Office",
                "county": "Nyeri",
                "sub_county": "Nyeri Town",
                "latitude": "-0.420100",
                "longitude": "36.947600",
            },
            {
                "name": "Kakamega Enterprise Enablement Hub",
                "county": "Kakamega",
                "sub_county": "Lurambi",
                "latitude": "0.282700",
                "longitude": "34.751900",
            },
        ],
    },
    {
        "name": "Digital Economy and Innovation Agency",
        "description": (
            "Seeded institution aligned to the digital superhighway and innovation pillar of "
            "Kenya's Bottom-Up Economic Transformation Agenda."
        ),
        "projects": [
            {
                "name": "Konza Digital Services Node",
                "county": "Machakos",
                "sub_county": "Mavoko",
                "latitude": "-1.610500",
                "longitude": "37.134100",
            },
            {
                "name": "Nairobi Public Wi-Fi Coordination Centre",
                "county": "Nairobi",
                "sub_county": "Westlands",
                "latitude": "-1.267500",
                "longitude": "36.810800",
            },
            {
                "name": "Kisii Innovation Outreach Hub",
                "county": "Kisii",
                "sub_county": "Kitutu Chache South",
                "latitude": "-0.677300",
                "longitude": "34.779600",
            },
        ],
    },
]


def _get_user_model(apps):
    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    return apps.get_model(app_label, model_name)


def _get_owner(User):
    return (
        User.objects.filter(is_superuser=True).order_by("id").first()
        or User.objects.filter(is_staff=True).order_by("id").first()
        or User.objects.order_by("id").first()
    )


def seed_beta_institutions(apps, schema_editor):
    User = _get_user_model(apps)
    Institution = apps.get_model("accounts", "Institution")
    InstitutionMembership = apps.get_model("accounts", "InstitutionMembership")
    SecurityFacility = apps.get_model("security", "SecurityFacility")

    owner = _get_owner(User)
    if owner is None:
        return

    for institution_seed in INSTITUTION_SEEDS:
        institution, _ = Institution.objects.get_or_create(
            name=institution_seed["name"],
            defaults={
                "description": institution_seed["description"],
                "owner": owner,
            },
        )

        changed = False
        if institution.owner_id != owner.id:
            institution.owner = owner
            changed = True
        if institution.description != institution_seed["description"]:
            institution.description = institution_seed["description"]
            changed = True
        if changed:
            institution.save(update_fields=["owner", "description"])

        InstitutionMembership.objects.get_or_create(
            institution=institution,
            user=owner,
            defaults={"role": "admin"},
        )

        for project in institution_seed["projects"]:
            SecurityFacility.objects.get_or_create(
                name=project["name"],
                institution=institution,
                defaults={
                    "facility_type": "administration",
                    "county": project["county"],
                    "sub_county": project["sub_county"],
                    "latitude": project["latitude"],
                    "longitude": project["longitude"],
                    "active": True,
                },
            )


def unseed_beta_institutions(apps, schema_editor):
    Institution = apps.get_model("accounts", "Institution")
    SecurityFacility = apps.get_model("security", "SecurityFacility")

    institution_names = [item["name"] for item in INSTITUTION_SEEDS]
    project_names = [
        project["name"]
        for institution_seed in INSTITUTION_SEEDS
        for project in institution_seed["projects"]
    ]

    SecurityFacility.objects.filter(name__in=project_names).delete()
    Institution.objects.filter(name__in=institution_names).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_facility_membership"),
        ("security", "0003_blockedip"),
    ]

    operations = [
        migrations.RunPython(seed_beta_institutions, unseed_beta_institutions),
    ]
