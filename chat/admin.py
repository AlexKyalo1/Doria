from django.contrib import admin

from .models import ChatActionLog, ChatConversation, ChatMessage, InstitutionChatWorkspace


admin.site.register(InstitutionChatWorkspace)
admin.site.register(ChatConversation)
admin.site.register(ChatMessage)
admin.site.register(ChatActionLog)

