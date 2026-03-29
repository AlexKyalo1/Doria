from django.urls import path

from . import views


urlpatterns = [
    path("admin/assistant/", views.admin_ai_assistant_api, name="chat-admin-assistant"),
    path("conversations/", views.ChatConversationListCreateView.as_view(), name="chat-conversation-list-create"),
    path("emergency-alerts/", views.EmergencyAlertListCreateView.as_view(), name="chat-emergency-alert-list-create"),
    path("emergency-alerts/<str:pk>/", views.EmergencyAlertDetailView.as_view(), name="chat-emergency-alert-detail"),
    path("conversations/<str:pk>/", views.ChatConversationDetailView.as_view(), name="chat-conversation-detail"),
    path("conversations/<str:pk>/messages/", views.ChatMessageCreateView.as_view(), name="chat-message-create"),
    path(
        "conversations/<str:pk>/ai-suggestions/",
        views.chat_conversation_ai_suggestions_api,
        name="chat-conversation-ai-suggestions",
    ),
    path(
        "conversations/<str:pk>/assistant/",
        views.chat_conversation_assistant_reply_api,
        name="chat-conversation-assistant-reply",
    ),
    path(
        "conversations/<str:pk>/create-incident/",
        views.chat_conversation_create_incident_api,
        name="chat-conversation-create-incident",
    ),
]
