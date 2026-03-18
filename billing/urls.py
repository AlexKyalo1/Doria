from django.urls import path

from . import views

urlpatterns = [
    path("plans/", views.billing_plan_list_api),
    path("admin/institutions/", views.admin_institutions_list_api),
    path("institutions/<str:institution_id>/", views.institution_billing_snapshot_api),
    path("institutions/<str:institution_id>/checkout/", views.institution_checkout_api),
    path("webhooks/stripe/", views.stripe_webhook_api),
    path("admin/institutions/<str:institution_id>/subscription/", views.admin_institution_subscription_api),
    path("admin/institutions/<str:institution_id>/overrides/", views.admin_institution_override_api),
    path("admin/institutions/<str:institution_id>/events/", views.admin_institution_events_api),
]
