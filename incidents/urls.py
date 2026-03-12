from django.urls import path
from . import views

urlpatterns = [
    path('', views.IncidentListCreateView.as_view(), name='incident-list-create'),
    path('<int:pk>/', views.IncidentDetailView.as_view(), name='incident-detail'),
    path('map/', views.incident_map_data, name='incident-map-data'),
]
