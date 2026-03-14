from django.urls import path
from . import views

urlpatterns = [
    path('facilities/<int:pk>/', views.SecurityFacilityDetailView.as_view(), name='facility-detail'),
    path('facilities/', views.SecurityFacilityListCreateView.as_view(), name='facilities'),
    path('blocked-ips/', views.blocked_ip_list_api, name='blocked-ip-list'),
    path('blocked-ips/<int:block_id>/unblock/', views.blocked_ip_unblock_api, name='blocked-ip-unblock'),
]
