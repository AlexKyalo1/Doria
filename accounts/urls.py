from django.urls import path
from .views import  login_api,register_api,profile_api

urlpatterns = [
    path('login/', login_api),
    path('register/', register_api),
    path('profile/', profile_api),


]