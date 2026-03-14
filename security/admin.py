from django.contrib import admin, messages
from django.utils import timezone

from .models import BlockedIP, SecurityFacility


@admin.register(SecurityFacility)
class SecurityFacilityAdmin(admin.ModelAdmin):
    list_display = ("name", "facility_type", "county", "sub_county", "active")
    search_fields = ("name", "county", "sub_county")
    list_filter = ("facility_type", "active", "county")


@admin.register(BlockedIP)
class BlockedIPAdmin(admin.ModelAdmin):
    list_display = ("ip_address", "trigger_status", "hit_count", "active", "blocked_at", "expires_at")
    search_fields = ("ip_address", "last_path", "reason")
    list_filter = ("trigger_status", "active")
    actions = ("unblock_selected_ips",)
    readonly_fields = ("blocked_at",)

    @admin.action(description="Unblock selected IPs")
    def unblock_selected_ips(self, request, queryset):
        updated = queryset.filter(active=True).update(active=False, expires_at=timezone.now())
        self.message_user(request, f"Unblocked {updated} IP entr{'y' if updated == 1 else 'ies'}.", level=messages.SUCCESS)
