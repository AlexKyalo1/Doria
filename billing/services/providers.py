from billing.constants import PROVIDER_STRIPE
from billing.providers.base import BillingProviderError
from billing.providers.stripe_provider import StripeBillingProvider


PROVIDERS = {
    PROVIDER_STRIPE: StripeBillingProvider(),
}


def get_provider(provider_code):
    provider = PROVIDERS.get(provider_code)
    if provider is None:
        raise BillingProviderError(f"Unsupported billing provider: {provider_code}")
    return provider
