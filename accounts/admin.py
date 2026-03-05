from django.contrib import admin

from .models import Institution, InstitutionMembership


@admin.register(Institution)
class InstitutionAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "created_at")
    search_fields = ("name", "owner__username", "owner__email")


@admin.register(InstitutionMembership)
class InstitutionMembershipAdmin(admin.ModelAdmin):
    list_display = ("institution", "user", "role", "joined_at")
    list_filter = ("role",)
    search_fields = ("institution__name", "user__username", "user__email")

