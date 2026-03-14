from django.db.models import Q

from security.models import SecurityFacility
from .models import InstitutionMembership


def is_site_admin(user):
    return bool(user and user.is_authenticated and getattr(user, "is_staff", False))


def facility_scope_for_user(user):
    if user is None or not user.is_authenticated:
        return SecurityFacility.objects.none()

    if is_site_admin(user):
        return SecurityFacility.objects.all()

    return SecurityFacility.objects.filter(
        Q(memberships__user=user)
        | Q(institution__owner=user)
        | Q(institution__institutionmembership__user=user, institution__institutionmembership__role="admin")
    ).distinct()


def facility_ids_for_user(user):
    return list(facility_scope_for_user(user).values_list("id", flat=True))


def institution_ids_for_user(user):
    if user is None or not user.is_authenticated:
        return []

    if is_site_admin(user):
        return []

    owned_ids = user.owned_institutions.values_list("id", flat=True)
    admin_member_ids = InstitutionMembership.objects.filter(
        user=user,
        role="admin",
    ).values_list("institution_id", flat=True)

    institution_ids = set(owned_ids)
    institution_ids.update(admin_member_ids)
    return list(institution_ids)
