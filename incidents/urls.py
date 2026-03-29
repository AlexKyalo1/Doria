from django.urls import path
from . import views

urlpatterns = [
    path('public-report/', views.public_incident_report_api, name='incident-public-report'),
    path('public-inquiry/', views.public_incident_inquiry_api, name='incident-public-inquiry'),
    path('', views.IncidentListCreateView.as_view(), name='incident-list-create'),
    path('map/', views.incident_map_data, name='incident-map-data'),
    path('ai-insights/', views.incident_ai_insights_api, name='incident-ai-insights'),
    path('area-analysis/', views.incident_area_analysis_api, name='incident-area-analysis'),
    path('<str:pk>/collaborators/', views.incident_collaboration_add_api, name='incident-collaboration-add'),
    path('<str:pk>/comments/', views.incident_comment_create_api, name='incident-comment-create'),
    path('<str:pk>/news-links/', views.incident_news_links_api, name='incident-news-links'),
    path('<str:pk>/updates/', views.IncidentUpdateCreateView.as_view(), name='incident-update-create'),
    path('<str:pk>/', views.IncidentDetailView.as_view(), name='incident-detail'),
]

