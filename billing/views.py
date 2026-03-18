from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from accounts.models import Institution, InstitutionMembership
from accounts.serializers import InstitutionSerializer
from billing.constants import PROVIDER_STRIPE
from billing.models import BillingFeature, BillingPlan, InstitutionEntitlementOverride, PaymentEvent
from billing.providers.base import BillingProviderError
from billing.serializers import (
    AdminEntitlementOverrideInputSerializer,
    AdminSubscriptionUpdateSerializer,
    BillingPlanSerializer,
    CheckoutSessionRequestSerializer,
    InstitutionBillingSnapshotSerializer,
    InstitutionEntitlementOverrideSerializer,
    InstitutionSubscriptionSerializer,
    PaymentEventSerializer,
    get_institution_by_hash,
)
from billing.services.entitlements import ensure_subscription_for_institution
from billing.services.providers import get_provider


def _is_billing_admin(user):
    return bool(user and user.is_authenticated and getattr(user, "is_staff", False))


def _can_manage_institution_billing(user, institution):
    if _is_billing_admin(user):
        return True
    if institution.owner_id == user.id:
        return True
    return InstitutionMembership.objects.filter(
        institution=institution,
        user=user,
        role="admin",
    ).exists()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def billing_plan_list_api(request):
    plans = BillingPlan.objects.filter(is_active=True).prefetch_related("entitlements__feature")
    return Response({"plans": BillingPlanSerializer(plans, many=True).data}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_institutions_list_api(request):
    if not _is_billing_admin(request.user):
        return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)

    institutions = Institution.objects.select_related("owner").order_by("name")
    return Response(
        {"institutions": InstitutionSerializer(institutions, many=True).data},
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def institution_billing_snapshot_api(request, institution_id):
    institution = get_institution_by_hash(institution_id)
    if institution is None:
        return Response({"error": "Institution not found"}, status=status.HTTP_404_NOT_FOUND)
    if not _can_manage_institution_billing(request.user, institution):
        return Response({"error": "Billing access denied"}, status=status.HTTP_403_FORBIDDEN)

    subscription = ensure_subscription_for_institution(institution)
    overrides = institution.entitlement_overrides.select_related("feature", "updated_by").all()
    serializer = InstitutionBillingSnapshotSerializer(
        {
            "institution": institution,
            "subscription": subscription,
            "overrides": overrides,
        }
    )
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def institution_checkout_api(request, institution_id):
    institution = get_institution_by_hash(institution_id)
    if institution is None:
        return Response({"error": "Institution not found"}, status=status.HTTP_404_NOT_FOUND)
    if not _can_manage_institution_billing(request.user, institution):
        return Response({"error": "Billing access denied"}, status=status.HTTP_403_FORBIDDEN)

    serializer = CheckoutSessionRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        plan = BillingPlan.objects.get(code=serializer.validated_data["plan_code"], is_active=True)
    except BillingPlan.DoesNotExist:
        return Response({"error": "Plan not found"}, status=status.HTTP_404_NOT_FOUND)

    subscription = ensure_subscription_for_institution(institution)

    try:
        provider = get_provider(PROVIDER_STRIPE)
        checkout_session = provider.create_checkout_session(
            institution=institution,
            subscription=subscription,
            plan=plan,
            success_url=serializer.validated_data.get("success_url"),
            cancel_url=serializer.validated_data.get("cancel_url"),
        )
    except BillingProviderError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    subscription.plan = plan
    subscription.save(update_fields=["plan", "updated_at"])

    return Response(
        {
            "subscription": InstitutionSubscriptionSerializer(subscription).data,
            "checkout": checkout_session,
        },
        status=status.HTTP_200_OK,
    )


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def stripe_webhook_api(request):
    signature = request.headers.get("Stripe-Signature", "")
    try:
        provider = get_provider(PROVIDER_STRIPE)
        payment_event = provider.handle_webhook(body=request.body, signature=signature)
    except BillingProviderError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response({"event": PaymentEventSerializer(payment_event).data}, status=status.HTTP_200_OK)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def admin_institution_subscription_api(request, institution_id):
    if not _is_billing_admin(request.user):
        return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)

    institution = get_institution_by_hash(institution_id)
    if institution is None:
        return Response({"error": "Institution not found"}, status=status.HTTP_404_NOT_FOUND)

    serializer = AdminSubscriptionUpdateSerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)

    subscription = ensure_subscription_for_institution(institution)
    data = serializer.validated_data

    plan_code = data.pop("plan_code", None)
    if plan_code:
        try:
            subscription.plan = BillingPlan.objects.get(code=plan_code)
        except BillingPlan.DoesNotExist:
            return Response({"error": "Plan not found"}, status=status.HTTP_404_NOT_FOUND)

    for field, value in data.items():
        setattr(subscription, field, value)
    subscription.save()
    return Response({"subscription": InstitutionSubscriptionSerializer(subscription).data}, status=status.HTTP_200_OK)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def admin_institution_override_api(request, institution_id):
    if not _is_billing_admin(request.user):
        return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)

    institution = get_institution_by_hash(institution_id)
    if institution is None:
        return Response({"error": "Institution not found"}, status=status.HTTP_404_NOT_FOUND)

    payload = request.data if isinstance(request.data, list) else [request.data]
    serializer = AdminEntitlementOverrideInputSerializer(data=payload, many=True)
    serializer.is_valid(raise_exception=True)

    updated = []
    for item in serializer.validated_data:
        try:
            feature = BillingFeature.objects.get(code=item["feature_code"])
        except BillingFeature.DoesNotExist:
            return Response(
                {"error": f"Feature not found: {item['feature_code']}"},
                status=status.HTTP_404_NOT_FOUND,
            )

        override, _ = InstitutionEntitlementOverride.objects.update_or_create(
            institution=institution,
            feature=feature,
            defaults={
                "is_enabled": item.get("is_enabled"),
                "limit_value": item.get("limit_value"),
                "reason": item.get("reason", ""),
                "updated_by": request.user,
            },
        )
        updated.append(override)

    return Response(
        {"overrides": InstitutionEntitlementOverrideSerializer(updated, many=True).data},
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_institution_events_api(request, institution_id):
    if not _is_billing_admin(request.user):
        return Response({"error": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)

    institution = get_institution_by_hash(institution_id)
    if institution is None:
        return Response({"error": "Institution not found"}, status=status.HTTP_404_NOT_FOUND)

    events = PaymentEvent.objects.filter(institution=institution)[:50]
    return Response({"events": PaymentEventSerializer(events, many=True).data}, status=status.HTTP_200_OK)
