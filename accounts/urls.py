from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import  login_api,register_api,profile_api

urlpatterns = [
    path('login/', login_api),
    path('register/', register_api),
    path('profile/', profile_api),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),


]
