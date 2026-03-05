from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import views
from .views import login_api, profile_api, profile_view_api, register_api

urlpatterns = [
    path("login/", login_api),
    path("register/", register_api),
    path("profile/", profile_api),
    path("profile/update/", profile_view_api, name="profile"),
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("admin/users/", views.admin_users_collection_api),
    path("admin/users/<str:user_id>/", views.admin_user_detail_api),
    path("institutions/", views.institutions_collection_api),
    path("institutions/<str:institution_id>/", views.institution_detail_api),
    path("institutions/<str:institution_id>/members/", views.institution_members_api),
    path(
        "institutions/<str:institution_id>/members/list/",
        views.institution_members_list_api,
    ),
    path(
        "institutions/<str:institution_id>/members/<str:user_id>/",
        views.institution_member_detail_api,
    ),
]
