from django.urls import path
from . import views

urlpatterns = [
    path('facilities/<int:pk>/', views.SecurityFacilityDetailView.as_view(), name='facility-detail'),
    path('facilities/', views.SecurityFacilityListCreateView.as_view(), name='facilities'),
]
