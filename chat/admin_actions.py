from decimal import Decimal, InvalidOperation

from django.contrib.auth.models import User
from django.utils import timezone

from accounts.models import Institution, InstitutionMembership
from billing.services.entitlements import BillingLimitError
from billing.services.entitlements import (
    assert_facility_limit_available,
    assert_member_limit_available,
    ensure_subscription_for_institution,
)
from security.models import BlockedIP, SecurityFacility
from utils.hashid import decode_id, encode_id


SUPPORTED_ACTIONS = {
    "answer_only",
    "list_users",
    "list_institutions",
    "create_institution",
    "create_facility",
    "add_institution_member",
    "update_user_access",
    "unblock_ip",
}


class AdminActionError(Exception):
    pass


def _normalize_text(value):
    if value is None:
        return ""
    return str(value).strip()


def _resolve_user(user_ref):
    value = _normalize_text(user_ref)
    if not value:
        raise AdminActionError("A user reference is required.")

    decoded_id = decode_id(value)
    if decoded_id:
        user = User.objects.filter(id=decoded_id).first()
        if user:
            return user

    user = User.objects.filter(username__iexact=value).first()
    if user:
        return user

    user = User.objects.filter(email__iexact=value).first()
    if user:
        return user

    raise AdminActionError(f'User "{value}" was not found.')


def _resolve_institution(institution_ref):
    value = _normalize_text(institution_ref)
    if not value:
        raise AdminActionError("An institution reference is required.")

    decoded_id = decode_id(value)
    if decoded_id:
        institution = Institution.objects.filter(id=decoded_id).first()
        if institution:
            return institution

    institution = Institution.objects.filter(name__iexact=value).first()
    if institution:
        return institution

    institution = Institution.objects.filter(name__icontains=value).order_by("name").first()
    if institution:
        return institution

    raise AdminActionError(f'Institution "{value}" was not found.')


def _resolve_decimal(value, *, field_name):
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise AdminActionError(f"{field_name} must be a valid decimal value.") from exc


def _result(action_type, status, message, data=None):
    return {
        "action_type": action_type,
        "status": status,
        "message": message,
        "data": data or {},
    }


def execute_admin_action(*, action, actor):
    action_type = action.get("action_type")
    if action_type not in SUPPORTED_ACTIONS:
        raise AdminActionError(f"Unsupported action type: {action_type}")

    parameters = action.get("parameters") or {}

    if action_type == "answer_only":
        return _result(
            "answer_only",
            "completed",
            _normalize_text(parameters.get("message")) or "No backend action was needed.",
        )

    if action_type == "list_users":
        query = _normalize_text(parameters.get("query"))
        limit = min(max(int(parameters.get("limit") or 10), 1), 25)
        queryset = User.objects.all().order_by("-date_joined")
        if query:
            queryset = queryset.filter(username__icontains=query)
        users = [
            {
                "id": encode_id(user.id),
                "username": user.username,
                "email": user.email,
                "is_active": user.is_active,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
            }
            for user in queryset[:limit]
        ]
        return _result("list_users", "completed", f"Found {len(users)} user(s).", {"users": users})

    if action_type == "list_institutions":
        query = _normalize_text(parameters.get("query"))
        limit = min(max(int(parameters.get("limit") or 10), 1), 25)
        queryset = Institution.objects.select_related("owner").order_by("name")
        if query:
            queryset = queryset.filter(name__icontains=query)
        institutions = [
            {
                "id": encode_id(institution.id),
                "name": institution.name,
                "owner_username": institution.owner.username,
                "description": institution.description,
            }
            for institution in queryset[:limit]
        ]
        return _result(
            "list_institutions",
            "completed",
            f"Found {len(institutions)} institution(s).",
            {"institutions": institutions},
        )

    if action_type == "create_institution":
        name = _normalize_text(parameters.get("name"))
        owner_username = _normalize_text(parameters.get("owner_username"))
        description = _normalize_text(parameters.get("description"))
        if not name:
            raise AdminActionError("Institution name is required.")
        if not owner_username:
            raise AdminActionError("owner_username is required to create an institution.")
        owner = _resolve_user(owner_username)
        institution = Institution.objects.create(name=name, description=description, owner=owner)
        ensure_subscription_for_institution(institution)
        InstitutionMembership.objects.get_or_create(
            institution=institution,
            user=owner,
            defaults={"role": "admin"},
        )
        return _result(
            "create_institution",
            "completed",
            f'Created institution "{institution.name}".',
            {
                "institution": {
                    "id": encode_id(institution.id),
                    "name": institution.name,
                    "owner_username": owner.username,
                }
            },
        )

    if action_type == "create_facility":
        institution = _resolve_institution(parameters.get("institution_ref"))
        name = _normalize_text(parameters.get("name"))
        facility_type = _normalize_text(parameters.get("facility_type"))
        county = _normalize_text(parameters.get("county"))
        sub_county = _normalize_text(parameters.get("sub_county"))
        active = parameters.get("active", True)
        if not name:
            raise AdminActionError("Facility name is required.")
        if facility_type not in {choice[0] for choice in SecurityFacility.FACILITY_TYPES}:
            raise AdminActionError("facility_type is invalid.")
        if not county:
            raise AdminActionError("county is required.")
        try:
            assert_facility_limit_available(institution)
        except BillingLimitError as exc:
            raise AdminActionError(str(exc)) from exc
        latitude = _resolve_decimal(parameters.get("latitude"), field_name="latitude")
        longitude = _resolve_decimal(parameters.get("longitude"), field_name="longitude")
        facility = SecurityFacility.objects.create(
            institution=institution,
            name=name,
            facility_type=facility_type,
            county=county,
            sub_county=sub_county,
            latitude=latitude,
            longitude=longitude,
            active=bool(active),
        )
        return _result(
            "create_facility",
            "completed",
            f'Created facility "{facility.name}" under "{institution.name}".',
            {
                "facility": {
                    "id": facility.id,
                    "name": facility.name,
                    "institution_id": encode_id(institution.id),
                    "institution_name": institution.name,
                }
            },
        )

    if action_type == "add_institution_member":
        institution = _resolve_institution(parameters.get("institution_ref"))
        user = _resolve_user(parameters.get("user_ref"))
        role = _normalize_text(parameters.get("role")) or "member"
        if role not in {"admin", "member"}:
            raise AdminActionError("role must be admin or member.")
        existing_membership = InstitutionMembership.objects.filter(institution=institution, user=user).first()
        if existing_membership is None:
            try:
                assert_member_limit_available(institution)
            except BillingLimitError as exc:
                raise AdminActionError(str(exc)) from exc
        membership, created = InstitutionMembership.objects.get_or_create(
            institution=institution,
            user=user,
            defaults={"role": role},
        )
        if not created and membership.role != role:
            membership.role = role
            membership.save(update_fields=["role"])
        verb = "Added" if created else "Updated"
        return _result(
            "add_institution_member",
            "completed",
            f'{verb} {user.username} as {membership.role} in "{institution.name}".',
            {
                "membership": {
                    "institution_id": encode_id(institution.id),
                    "institution_name": institution.name,
                    "user_id": encode_id(user.id),
                    "username": user.username,
                    "role": membership.role,
                }
            },
        )

    if action_type == "update_user_access":
        user = _resolve_user(parameters.get("user_ref"))
        is_active = parameters.get("is_active")
        is_staff = parameters.get("is_staff")
        if is_active is None and is_staff is None:
            raise AdminActionError("At least one of is_active or is_staff must be provided.")
        if user.id == actor.id and is_staff is False:
            raise AdminActionError("You cannot remove your own staff access.")
        updated_fields = []
        if is_active is not None and bool(is_active) != user.is_active:
            user.is_active = bool(is_active)
            updated_fields.append("is_active")
        if is_staff is not None and bool(is_staff) != user.is_staff:
            user.is_staff = bool(is_staff)
            updated_fields.append("is_staff")
        if updated_fields:
            user.save(update_fields=updated_fields)
        return _result(
            "update_user_access",
            "completed",
            f"Updated access for {user.username}.",
            {
                "user": {
                    "id": encode_id(user.id),
                    "username": user.username,
                    "is_active": user.is_active,
                    "is_staff": user.is_staff,
                }
            },
        )

    if action_type == "unblock_ip":
        block_id = parameters.get("block_id")
        ip_address = _normalize_text(parameters.get("ip_address"))
        blocked_ip = None
        if block_id not in (None, ""):
            blocked_ip = BlockedIP.objects.filter(pk=block_id).first()
        if blocked_ip is None and ip_address:
            blocked_ip = BlockedIP.objects.filter(ip_address=ip_address).order_by("-active", "-blocked_at").first()
        if blocked_ip is None:
            raise AdminActionError("Blocked IP was not found.")
        blocked_ip.active = False
        blocked_ip.expires_at = timezone.now()
        blocked_ip.save(update_fields=["active", "expires_at"])
        return _result(
            "unblock_ip",
            "completed",
            f"Unblocked IP {blocked_ip.ip_address}.",
            {"blocked_ip": {"id": blocked_ip.id, "ip_address": blocked_ip.ip_address, "active": blocked_ip.active}},
        )

    raise AdminActionError(f"Action type {action_type} is not implemented.")
