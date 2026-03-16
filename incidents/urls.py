from django.urls import path
from . import views

urlpatterns = [
    path('', views.IncidentListCreateView.as_view(), name='incident-list-create'),
    path('map/', views.incident_map_data, name='incident-map-data'),
    path('ai-insights/', views.incident_ai_insights_api, name='incident-ai-insights'),
    path('<str:pk>/', views.IncidentDetailView.as_view(), name='incident-detail'),
]

