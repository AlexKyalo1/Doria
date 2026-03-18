import json
from datetime import datetime, timezone as dt_timezone

from django.conf import settings
from django.utils import timezone

from billing.constants import (
    PROVIDER_STRIPE,
    SUBSCRIPTION_STATUS_ACTIVE,
    SUBSCRIPTION_STATUS_CANCELED,
    SUBSCRIPTION_STATUS_PAST_DUE,
)
from billing.models import InstitutionSubscription, PaymentEvent, PaymentProviderCustomer
from .base import BaseBillingProvider, BillingProviderError


class StripeBillingProvider(BaseBillingProvider):
    provider_code = PROVIDER_STRIPE

    def _get_client(self):
        secret_key = getattr(settings, "STRIPE_SECRET_KEY", "")
        if not secret_key:
            raise BillingProviderError("Stripe is not configured.")
        try:
            import stripe  # type: ignore
        except ImportError as exc:
            raise BillingProviderError("Stripe SDK is not installed.") from exc

        stripe.api_key = secret_key
        return stripe

    def _get_or_create_customer(self, stripe, institution, subscription):
        existing_customer_id = subscription.provider_customer_id
        if existing_customer_id:
            return existing_customer_id

        provider_customer = PaymentProviderCustomer.objects.filter(
            institution=institution,
            provider=self.provider_code,
        ).first()
        if provider_customer:
            return provider_customer.customer_id

        customer = stripe.Customer.create(
            name=institution.name,
            metadata={
                "institution_id": str(institution.id),
                "institution_name": institution.name,
            },
        )

        PaymentProviderCustomer.objects.update_or_create(
            institution=institution,
            provider=self.provider_code,
            defaults={
                "customer_id": customer["id"],
                "metadata": {
                    "name": institution.name,
                },
            },
        )
        return customer["id"]

    def create_checkout_session(self, *, institution, subscription, plan, success_url=None, cancel_url=None):
        stripe = self._get_client()
        if not plan.stripe_price_id:
            raise BillingProviderError("Selected plan is not mapped to a Stripe price.")

        customer_id = self._get_or_create_customer(stripe, institution, subscription)
        success = success_url or getattr(settings, "BILLING_STRIPE_SUCCESS_URL", "")
        cancel = cancel_url or getattr(settings, "BILLING_STRIPE_CANCEL_URL", "")
        if not success or not cancel:
            raise BillingProviderError("Stripe success and cancel URLs must be configured.")

        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": plan.stripe_price_id, "quantity": 1}],
            success_url=success,
            cancel_url=cancel,
            metadata={
                "institution_id": str(institution.id),
                "plan_code": plan.code,
            },
        )

        subscription.provider = self.provider_code
        subscription.provider_customer_id = customer_id
        subscription.metadata = {
            **(subscription.metadata or {}),
            "checkout_session_id": session["id"],
        }
        subscription.save(update_fields=["provider", "provider_customer_id", "metadata", "updated_at"])

        return {
            "id": session["id"],
            "url": session.get("url"),
        }

    def cancel_subscription(self, subscription):
        stripe = self._get_client()
        if not subscription.provider_subscription_id:
            raise BillingProviderError("Subscription is not linked to Stripe.")
        stripe.Subscription.modify(subscription.provider_subscription_id, cancel_at_period_end=True)
        subscription.cancel_at_period_end = True
        subscription.save(update_fields=["cancel_at_period_end", "updated_at"])
        return subscription

    def handle_webhook(self, *, body, signature):
        stripe = self._get_client()
        endpoint_secret = getattr(settings, "STRIPE_WEBHOOK_SECRET", "")
        try:
            if endpoint_secret:
                event = stripe.Webhook.construct_event(body, signature, endpoint_secret)
            else:
                event = json.loads(body.decode("utf-8"))
        except Exception as exc:
            raise BillingProviderError(f"Invalid Stripe webhook: {exc}") from exc

        event_id = event.get("id")
        event_type = event.get("type")
        data_object = (event.get("data") or {}).get("object") or {}
        metadata = data_object.get("metadata") or {}
        institution_id = metadata.get("institution_id")

        payment_event, _ = PaymentEvent.objects.get_or_create(
            event_id=event_id,
            defaults={
                "provider": self.provider_code,
                "event_type": event_type or "unknown",
                "provider_customer_id": data_object.get("customer", "") or "",
                "provider_subscription_id": data_object.get("subscription", "") or data_object.get("id", "") or "",
                "payload": event,
                "institution_id": institution_id or None,
            },
        )

        institution_subscription = InstitutionSubscription.objects.filter(
            provider_customer_id=data_object.get("customer", "") or "",
        ).first()

        if institution_subscription and event_type in {
            "checkout.session.completed",
            "customer.subscription.created",
            "customer.subscription.updated",
            "customer.subscription.deleted",
            "invoice.payment_failed",
        }:
            stripe_status = data_object.get("status")
            if event_type == "customer.subscription.deleted":
                institution_subscription.status = SUBSCRIPTION_STATUS_CANCELED
            elif event_type == "invoice.payment_failed":
                institution_subscription.status = SUBSCRIPTION_STATUS_PAST_DUE
            elif stripe_status in {"trialing", "active"}:
                institution_subscription.status = SUBSCRIPTION_STATUS_ACTIVE
            if data_object.get("id"):
                institution_subscription.provider_subscription_id = data_object["id"]
            if data_object.get("current_period_start"):
                institution_subscription.current_period_start = datetime.fromtimestamp(
                    data_object["current_period_start"],
                    tz=dt_timezone.utc,
                )
            if data_object.get("current_period_end"):
                institution_subscription.current_period_end = datetime.fromtimestamp(
                    data_object["current_period_end"],
                    tz=dt_timezone.utc,
                )
            institution_subscription.metadata = {
                **(institution_subscription.metadata or {}),
                "last_stripe_event": event_type,
            }
            institution_subscription.save()

        payment_event.processed_at = timezone.now()
        payment_event.payload = event
        payment_event.save(update_fields=["processed_at", "payload"])
        return payment_event
