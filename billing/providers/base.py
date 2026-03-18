class BillingProviderError(Exception):
    pass


class BaseBillingProvider:
    provider_code = None

    def create_checkout_session(self, *, institution, subscription, plan, success_url=None, cancel_url=None):
        raise NotImplementedError

    def cancel_subscription(self, subscription):
        raise NotImplementedError

    def handle_webhook(self, *, body, signature):
        raise NotImplementedError
