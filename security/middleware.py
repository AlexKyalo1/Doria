from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse
from django.utils import timezone

from .models import BlockedIP


class ResponseGuardMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        ip_address = self._get_client_ip(request)
        request.guard_client_ip = ip_address

        if self._is_blocked(ip_address):
            return JsonResponse(
                {"error": "Access denied", "detail": "This IP address is temporarily blocked."},
                status=403,
            )

        response = self.get_response(request)
        self._track_response(ip_address, request.path, response.status_code)
        return response

    def _track_response(self, ip_address, path, status_code):
        if not ip_address or self._is_whitelisted(ip_address):
            return

        rules = getattr(settings, "SECURITY_RESPONSE_RULES", {})
        rule = rules.get(status_code)
        if not rule:
            return

        cache_key = f"response-guard:{status_code}:{ip_address}"
        hit_count = cache.get(cache_key, 0) + 1
        cache.set(cache_key, hit_count, timeout=rule["window_seconds"])

        if hit_count < rule["threshold"]:
            return

        expires_at = timezone.now() + timedelta(seconds=rule["block_seconds"])
        reason = rule.get("reason") or f"Exceeded {status_code} threshold"
        BlockedIP.objects.update_or_create(
            ip_address=ip_address,
            defaults={
                "trigger_status": status_code,
                "hit_count": hit_count,
                "last_path": path[:255],
                "reason": reason,
                "blocked_at": timezone.now(),
                "expires_at": expires_at,
                "active": True,
            },
        )
        cache.delete(cache_key)

    def _is_blocked(self, ip_address):
        if not ip_address or self._is_whitelisted(ip_address):
            return False

        try:
            blocked = BlockedIP.objects.get(ip_address=ip_address, active=True)
        except BlockedIP.DoesNotExist:
            return False

        if blocked.is_expired():
            blocked.active = False
            blocked.save(update_fields=["active"])
            return False

        return True

    def _is_whitelisted(self, ip_address):
        whitelist = getattr(settings, "SECURITY_IP_WHITELIST", [])
        return ip_address in whitelist

    def _get_client_ip(self, request):
        forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "")
