from datetime import timedelta

from django.db.models import Count
from django.db.models import Q
from django.conf import settings
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.access import facility_ids_for_user, institution_ids_for_user, is_site_admin
from accounts.models import FacilityMembership, Institution, InstitutionMembership
from billing.constants import FEATURE_MAX_AI_QUERIES_PER_MONTH
from billing.services.entitlements import (
    BillingLimitError,
    assert_ai_feature_enabled,
    assert_ai_usage_available,
    get_ai_usage_summary,
    increment_feature_usage,
)
from incidents.ai import IncidentInsightsError, generate_incident_insights
from incidents.intelligence import (
    AreaAnalysisError,
    fetch_area_news,
    fetch_incident_news,
    generate_area_analysis,
    haversine_km,
)
from incidents.public_ai import (
    PublicIncidentMatchError,
    analyze_public_incident_image,
    generate_public_incident_match,
)
from security.models import SecurityFacility
from utils.hashid import decode_id
from .models import Incident, IncidentActivity, IncidentComment, IncidentInstitutionAccess
from .serializers import (
    IncidentCommentCreateSerializer,
    IncidentInstitutionAccessCreateSerializer,
    IncidentSerializer,
    IncidentUpdateCreateSerializer,
    PublicIncidentInquirySerializer,
    PublicIncidentReportSerializer,
)


INCIDENT_ANALYTICS_FALLBACK = {
    "summary": "No incidents matched the selected filters.",
    "risk_level": "low",
    "top_patterns": [],
    "priority_actions": [],
    "follow_up_gaps": [],
    "incident_breakdown": [],
    "facility_hotspots": [],
    "recommended_queries": [],
}


def _generate_public_ob_number():
    return f"PUB-{timezone.now():%Y%m%d%H%M%S}"


def _date_range(start, end):
    days = (end - start).days
    return [start + timedelta(days=offset) for offset in range(days + 1)]


def _build_ai_analytics(queryset, *, date_from=None, date_to=None):
    today = timezone.now().date()
    if date_to is None:
        date_to = today
    if date_from is None:
        date_from = date_to - timedelta(days=30)

    current_start = date_from
    current_end = date_to
    period_days = max(1, (current_end - current_start).days + 1)
    prev_end = current_start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=period_days - 1)

    current_qs = queryset.filter(occurred_at__date__gte=current_start, occurred_at__date__lte=current_end)
    prev_qs = queryset.filter(occurred_at__date__gte=prev_start, occurred_at__date__lte=prev_end)

    current_total = current_qs.count()
    open_total = current_qs.filter(follow_up_status="open").count()
    resolved_total = current_qs.filter(follow_up_status="resolved").count()

    open_ages = []
    for item in current_qs.filter(follow_up_status="open").values("occurred_at", "reported_at"):
        occurred_at = item.get("occurred_at") or item.get("reported_at")
        if occurred_at:
            open_ages.append((today - occurred_at.date()).days)
    avg_open_age = round(sum(open_ages) / len(open_ages), 1) if open_ages else 0

    daily_counts_raw = current_qs.values("occurred_at__date").annotate(count=Count("id")).order_by("occurred_at__date")
    daily_map = {row["occurred_at__date"].isoformat(): row["count"] for row in daily_counts_raw if row["occurred_at__date"]}
    daily_counts = [
        {"date": day.isoformat(), "count": daily_map.get(day.isoformat(), 0)}
        for day in _date_range(current_start, current_end)
    ]

    current_types = {row["incident_type"] or "unknown": row["count"] for row in current_qs.values("incident_type").annotate(count=Count("id"))}
    prev_types = {row["incident_type"] or "unknown": row["count"] for row in prev_qs.values("incident_type").annotate(count=Count("id"))}

    type_trends = []
    for incident_type, count in sorted(current_types.items(), key=lambda item: item[1], reverse=True):
        prev_count = prev_types.get(incident_type, 0)
        delta = count - prev_count
        pct_change = round((delta / prev_count) * 100, 1) if prev_count else None
        type_trends.append({
            "incident_type": incident_type,
            "current_count": count,
            "previous_count": prev_count,
            "delta": delta,
            "pct_change": pct_change,
        })

    anomalies = []
    for item in type_trends:
        current_count = item["current_count"]
        previous_count = item["previous_count"]
        if previous_count == 0 and current_count >= 3:
            anomalies.append({**item, "reason": "new_spike"})
        elif previous_count > 0 and current_count >= max(3, previous_count * 2) and (current_count - previous_count) >= 3:
            anomalies.append({**item, "reason": "surge"})

    facility_rows = current_qs.values("facility_id", "facility__name", "follow_up_status", "occurred_at")
    facility_stats = {}
    for row in facility_rows:
        facility_id = row["facility_id"] or "unassigned"
        name = row.get("facility__name") or "Unassigned"
        stats = facility_stats.setdefault(
            facility_id,
            {"facility_id": facility_id, "facility_name": name, "total": 0, "open": 0, "resolved": 0, "open_ages": []},
        )
        stats["total"] += 1
        status = row.get("follow_up_status")
        if status == "open":
            stats["open"] += 1
            occurred_at = row.get("occurred_at")
            if occurred_at:
                stats["open_ages"].append((today - occurred_at.date()).days)
        elif status == "resolved":
            stats["resolved"] += 1

    facility_risk = []
    for stats in facility_stats.values():
        avg_age = round(sum(stats["open_ages"]) / len(stats["open_ages"]), 1) if stats["open_ages"] else 0
        facility_risk.append({
            "facility_id": stats["facility_id"],
            "facility_name": stats["facility_name"],
            "total_incidents": stats["total"],
            "open_followups": stats["open"],
            "resolved_followups": stats["resolved"],
            "avg_open_age_days": avg_age,
        })

    facility_risk.sort(key=lambda item: (item["open_followups"], item["total_incidents"]), reverse=True)

    return {
        "period": {
            "start": current_start.isoformat(),
            "end": current_end.isoformat(),
            "previous_start": prev_start.isoformat(),
            "previous_end": prev_end.isoformat(),
        },
        "kpis": {
            "total_incidents": current_total,
            "open_followups": open_total,
            "resolved_followups": resolved_total,
            "resolution_rate": round((resolved_total / current_total) * 100, 1) if current_total else 0,
            "avg_open_age_days": avg_open_age,
            "incidents_last_7_days": queryset.filter(occurred_at__date__gte=today - timedelta(days=6)).count(),
        },
        "trends": {
            "daily_counts": daily_counts,
            "type_trends": type_trends,
        },
        "anomalies": anomalies,
        "facility_risk": facility_risk,
    }


def _incident_scope_for_user(user):
    qs = Incident.objects.all()
    if user is None or not user.is_authenticated:
        return qs.none()
    if is_site_admin(user):
        return qs

    facility_ids = facility_ids_for_user(user)
    institution_ids = _user_institution_ids(user)

    if not facility_ids and not institution_ids:
        return qs.none()

    return qs.filter(
        Q(facility_id__in=facility_ids)
        | Q(institution_id__in=institution_ids)
        | Q(facility__institution_id__in=institution_ids)
        | Q(facility__isnull=True, institution_id__in=institution_ids)
        | Q(institution_access__institution_id__in=institution_ids)
    )


def _incident_with_related(queryset):
    return queryset.select_related(
        "facility",
        "facility__institution",
        "institution",
        "follow_up_by",
    ).prefetch_related(
        "updates__created_by",
        "institution_access__institution",
        "institution_access__shared_by",
        "comments__created_by",
        "comments__actor_institution",
        "comments__actor_facility",
        "activity__actor",
        "activity__actor_institution",
        "activity__actor_facility",
    )


def _can_follow_up(user, incident):
    if user is None or not user.is_authenticated:
        return False
    if getattr(user, "is_staff", False):
        return True
    if incident.facility_id and FacilityMembership.objects.filter(
        facility_id=incident.facility_id,
        user_id=user.id,
    ).exists():
        return True
    institution_ids = _user_institution_ids(user)
    institution = incident.institution
    if institution is None and incident.facility_id and incident.facility and incident.facility.institution_id:
        institution = incident.facility.institution
    if institution is not None and institution.id in institution_ids:
        return True
    return IncidentInstitutionAccess.objects.filter(
        incident=incident,
        institution_id__in=institution_ids,
        access_level__in=[
            IncidentInstitutionAccess.ACCESS_CONTRIBUTOR,
            IncidentInstitutionAccess.ACCESS_LEAD,
        ],
    ).exists()


def _user_institution_ids(user):
    if user is None or not user.is_authenticated:
        return []
    owned_ids = user.owned_institutions.values_list("id", flat=True)
    member_ids = InstitutionMembership.objects.filter(user=user).values_list("institution_id", flat=True)
    institution_ids = set(owned_ids)
    institution_ids.update(member_ids)
    return list(institution_ids)


def _incident_base_institution_id(incident):
    if incident.institution_id:
        return incident.institution_id
    if incident.facility_id and incident.facility and incident.facility.institution_id:
        return incident.facility.institution_id
    return None


def _can_manage_collaboration(user, incident):
    if user is None or not user.is_authenticated:
        return False
    if is_site_admin(user):
        return True

    admin_institution_ids = set(institution_ids_for_user(user))
    base_institution_id = _incident_base_institution_id(incident)
    if base_institution_id and base_institution_id in admin_institution_ids:
        return True

    return IncidentInstitutionAccess.objects.filter(
        incident=incident,
        institution_id__in=admin_institution_ids,
        access_level=IncidentInstitutionAccess.ACCESS_LEAD,
    ).exists()


def _resolve_actor_context(user, incident, preferred_institution_id=None):
    if user is None or not user.is_authenticated:
        return None, None

    if incident.facility_id and FacilityMembership.objects.filter(facility_id=incident.facility_id, user_id=user.id).exists():
        facility = incident.facility
        return facility.institution if facility and facility.institution_id else None, facility

    user_institution_ids = set(_user_institution_ids(user))
    institution = None
    if preferred_institution_id and preferred_institution_id in user_institution_ids:
        institution = Institution.objects.filter(id=preferred_institution_id).first()
    elif incident.institution_id and incident.institution_id in user_institution_ids:
        institution = incident.institution
    elif incident.facility_id and incident.facility and incident.facility.institution_id in user_institution_ids:
        institution = incident.facility.institution
    else:
        shared_id = IncidentInstitutionAccess.objects.filter(
            incident=incident,
            institution_id__in=user_institution_ids,
        ).values_list("institution_id", flat=True).first()
        if shared_id:
            institution = Institution.objects.filter(id=shared_id).first()

    return institution, None


def _record_incident_activity(incident, *, actor, action_type, summary, metadata=None, preferred_institution_id=None):
    actor_institution, actor_facility = _resolve_actor_context(
        actor,
        incident,
        preferred_institution_id=preferred_institution_id,
    )
    IncidentActivity.objects.create(
        incident=incident,
        actor=actor,
        actor_institution=actor_institution,
        actor_facility=actor_facility,
        action_type=action_type,
        summary=summary,
        metadata=metadata or {},
    )


def _institutions_for_ai_request(queryset, *, institution_id=None, facility_id=None):
    institutions = []
    if institution_id:
        institution = Institution.objects.filter(id=institution_id).first()
        if institution:
            return [institution]
    if facility_id:
        facility = SecurityFacility.objects.select_related("institution").filter(id=facility_id).first()
        if facility and facility.institution_id:
            return [facility.institution]
        return []

    institution_ids = set(
        queryset.exclude(institution_id__isnull=True).values_list("institution_id", flat=True)
    )
    institution_ids.update(
        queryset.exclude(facility__institution_id__isnull=True).values_list("facility__institution_id", flat=True)
    )
    if not institution_ids:
        return []
    return list(Institution.objects.filter(id__in=institution_ids))


def _parse_float(value, *, field_name):
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be a valid number.")
    return parsed


def _normalize_contact(value):
    raw = (value or "").strip()
    digits = "".join(ch for ch in raw if ch.isdigit())
    if digits:
        return digits
    return raw.lower()


def _public_incident_scope_for_inquiry(reference, reporter_contact):
    normalized_reference = (reference or "").strip().upper()
    normalized_contact = _normalize_contact(reporter_contact)
    if not normalized_reference or not normalized_contact:
        return Incident.objects.none()

    queryset = Incident.objects.select_related("facility", "institution").filter(
        source=Incident.SOURCE_PUBLIC,
        ob_number__iexact=normalized_reference,
    )
    matched_ids = []
    for incident in queryset:
        if _normalize_contact(incident.reporter_contact) == normalized_contact:
            matched_ids.append(incident.id)
    if not matched_ids:
        return Incident.objects.none()
    return queryset.filter(id__in=matched_ids)


def _serialize_public_incident_for_inquiry(incident):
    institution_name = ""
    if incident.institution_id and incident.institution:
        institution_name = incident.institution.name
    elif incident.facility_id and incident.facility and incident.facility.institution_id:
        institution_name = incident.facility.institution.name

    return {
        "reference": incident.ob_number,
        "incident_type": incident.incident_type,
        "description": incident.description,
        "status": incident.follow_up_status,
        "follow_up_note": incident.follow_up_note,
        "occurred_at": incident.occurred_at.isoformat() if incident.occurred_at else "",
        "reported_at": incident.reported_at.isoformat() if incident.reported_at else "",
        "institution_name": institution_name,
        "facility_name": incident.facility.name if incident.facility_id and incident.facility else "",
        "location_hint": incident.public_location_hint,
        "latitude": float(incident.latitude),
        "longitude": float(incident.longitude),
    }


def _resolve_area_analysis_institution(user, institution_hash):
    if is_site_admin(user):
        if not institution_hash:
            return None
        institution_id = decode_id(institution_hash)
        if not institution_id:
            raise ValueError("Invalid institution id")
        institution = Institution.objects.filter(id=institution_id).first()
        if institution is None:
            raise ValueError("Institution not found")
        return institution

    allowed_ids = set(institution_ids_for_user(user))
    if not allowed_ids:
        raise PermissionError("Institution admin access is required")

    if institution_hash:
        institution_id = decode_id(institution_hash)
        if not institution_id:
            raise ValueError("Invalid institution id")
        if institution_id not in allowed_ids:
            raise PermissionError("You can only analyze institutions you administer")
        institution = Institution.objects.filter(id=institution_id).first()
        if institution is None:
            raise ValueError("Institution not found")
        return institution

    institution = Institution.objects.filter(id__in=allowed_ids).order_by("name").first()
    if institution is None:
        raise PermissionError("Institution admin access is required")
    return institution


class IncidentListCreateView(generics.ListCreateAPIView):
    serializer_class = IncidentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return _incident_with_related(_incident_scope_for_user(self.request.user)).order_by("-occurred_at").distinct()


class IncidentDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = IncidentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return _incident_with_related(_incident_scope_for_user(self.request.user)).distinct()

    def get_object(self):
        queryset = self.get_queryset()
        lookup = self.kwargs.get("pk")
        decoded_id = decode_id(lookup)
        if not decoded_id:
            from django.http import Http404
            raise Http404
        return queryset.get(id=decoded_id)

    def update(self, request, *args, **kwargs):
        incident = self.get_object()
        follow_up_requested = any(
            key in request.data for key in ("follow_up_note", "follow_up_status")
        )
        if follow_up_requested and not _can_follow_up(request.user, incident):
            return Response(
                {"error": "Only authorized facility or institution members can update follow-ups"},
                status=status.HTTP_403_FORBIDDEN,
            )

        partial = kwargs.pop("partial", False)
        previous_follow_up_status = incident.follow_up_status
        previous_follow_up_note = incident.follow_up_note
        previous_latitude = str(incident.latitude)
        previous_longitude = str(incident.longitude)
        serializer = self.get_serializer(incident, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        if follow_up_requested:
            serializer.save(follow_up_by=request.user, follow_up_at=timezone.now())
        else:
            serializer.save()

        incident.refresh_from_db()
        if follow_up_requested and (
            incident.follow_up_status != previous_follow_up_status
            or incident.follow_up_note != previous_follow_up_note
        ):
            _record_incident_activity(
                incident,
                actor=request.user,
                action_type=IncidentActivity.ACTION_FOLLOW_UP_CHANGED,
                summary=f"Changed follow-up status to {incident.follow_up_status.replace('_', ' ')}.",
                metadata={
                    "from_status": previous_follow_up_status,
                    "to_status": incident.follow_up_status,
                    "note": incident.follow_up_note,
                },
            )
        if str(incident.latitude) != previous_latitude or str(incident.longitude) != previous_longitude:
            _record_incident_activity(
                incident,
                actor=request.user,
                action_type=IncidentActivity.ACTION_LOCATION_UPDATED,
                summary="Updated incident map coordinates.",
                metadata={
                    "from": {"latitude": previous_latitude, "longitude": previous_longitude},
                    "to": {"latitude": str(incident.latitude), "longitude": str(incident.longitude)},
                },
            )

        return Response(serializer.data)


class IncidentUpdateCreateView(generics.CreateAPIView):
    serializer_class = IncidentUpdateCreateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return _incident_scope_for_user(self.request.user).distinct()

    def get_object(self):
        queryset = self.get_queryset()
        lookup = self.kwargs.get("pk")
        decoded_id = decode_id(lookup)
        if not decoded_id:
            from django.http import Http404
            raise Http404
        return queryset.get(id=decoded_id)

    def create(self, request, *args, **kwargs):
        incident = self.get_object()
        if not _can_follow_up(request.user, incident):
            return Response(
                {"error": "Only authorized facility or institution members can update incidents"},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        update = serializer.save(incident=incident, created_by=request.user)

        incident.follow_up_status = update.status
        incident.follow_up_note = update.note
        incident.follow_up_by = request.user
        incident.follow_up_at = timezone.now()
        incident.save(update_fields=["follow_up_status", "follow_up_note", "follow_up_by", "follow_up_at"])
        _record_incident_activity(
            incident,
            actor=request.user,
            action_type=IncidentActivity.ACTION_UPDATE_ADDED,
            summary=f"Added an operational update and set status to {update.status.replace('_', ' ')}.",
            metadata={
                "status": update.status,
                "note": update.note,
                "action_taken": update.action_taken,
                "assigned_to_name": update.assigned_to_name,
                "next_step": update.next_step,
                "due_at": update.due_at.isoformat() if update.due_at else None,
            },
        )

        return Response(IncidentSerializer(incident, context={"request": request}).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def incident_collaboration_add_api(request, pk):
    decoded_id = decode_id(pk)
    if not decoded_id:
        return Response({"error": "Invalid incident id"}, status=status.HTTP_404_NOT_FOUND)

    incident = _incident_scope_for_user(request.user).filter(id=decoded_id).first()
    if incident is None:
        return Response({"error": "Incident not found"}, status=status.HTTP_404_NOT_FOUND)
    if not _can_manage_collaboration(request.user, incident):
        return Response(
            {"error": "Only the owning institution or a collaboration lead can share this incident"},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = IncidentInstitutionAccessCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    institution_id = serializer.validated_data["institution_id"]
    access_level = serializer.validated_data["access_level"]

    institution = Institution.objects.filter(id=institution_id).first()
    if institution is None:
        return Response({"error": "Institution not found"}, status=status.HTTP_404_NOT_FOUND)

    base_institution_id = _incident_base_institution_id(incident)
    if base_institution_id and institution.id == base_institution_id:
        return Response({"error": "Incident already belongs to that institution"}, status=status.HTTP_400_BAD_REQUEST)

    access, created = IncidentInstitutionAccess.objects.get_or_create(
        incident=incident,
        institution=institution,
        defaults={"access_level": access_level, "shared_by": request.user},
    )
    if not created and access.access_level != access_level:
        access.access_level = access_level
        access.shared_by = request.user
        access.save(update_fields=["access_level", "shared_by"])

    _record_incident_activity(
        incident,
        actor=request.user,
        action_type=IncidentActivity.ACTION_INSTITUTION_SHARED,
        summary=f"Shared the incident with {institution.name} as {access.access_level}.",
        metadata={
            "institution_name": institution.name,
            "institution_id": institution.id,
            "access_level": access.access_level,
            "created": created,
        },
        preferred_institution_id=base_institution_id,
    )

    return Response(
        IncidentSerializer(incident, context={"request": request}).data,
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def incident_comment_create_api(request, pk):
    decoded_id = decode_id(pk)
    if not decoded_id:
        return Response({"error": "Invalid incident id"}, status=status.HTTP_404_NOT_FOUND)

    incident = _incident_scope_for_user(request.user).filter(id=decoded_id).first()
    if incident is None:
        return Response({"error": "Incident not found"}, status=status.HTTP_404_NOT_FOUND)
    if not _can_follow_up(request.user, incident):
        return Response(
            {"error": "Only contributing institutions can comment on this incident"},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = IncidentCommentCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    actor_institution, actor_facility = _resolve_actor_context(request.user, incident)
    comment = IncidentComment.objects.create(
        incident=incident,
        body=serializer.validated_data["body"],
        created_by=request.user,
        actor_institution=actor_institution,
        actor_facility=actor_facility,
    )
    _record_incident_activity(
        incident,
        actor=request.user,
        action_type=IncidentActivity.ACTION_COMMENT_ADDED,
        summary="Added a collaboration comment.",
        metadata={"body": comment.body},
        preferred_institution_id=actor_institution.id if actor_institution else None,
    )

    return Response(
        IncidentSerializer(incident, context={"request": request}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def incident_map_data(request):
    qs = _incident_scope_for_user(request.user).distinct()
    institution_id = request.GET.get("institution_id")
    if institution_id:
        qs = qs.filter(institution_id=institution_id)

    data = list(
        qs.select_related("facility", "follow_up_by").values(
            "id",
            "ob_number",
            "incident_type",
            "description",
            "facility_id",
            "facility__name",
            "institution_id",
            "latitude",
            "longitude",
            "occurred_at",
            "follow_up_status",
            "follow_up_note",
            "follow_up_at",
            "follow_up_by__username",
        )
    )
    for item in data:
        item["facility_name"] = item.pop("facility__name")
        item["follow_up_by_name"] = item.pop("follow_up_by__username")
    return JsonResponse(data, safe=False)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def incident_ai_insights_api(request):
    payload = request.data or {}
    queryset = _incident_scope_for_user(request.user).select_related("facility", "institution").distinct()

    institution_hash = payload.get("institution_id")
    institution_id = None
    if institution_hash:
        institution_id = decode_id(institution_hash)
        if not institution_id:
            return Response({"error": "Invalid institution id"}, status=status.HTTP_400_BAD_REQUEST)
        queryset = queryset.filter(institution_id=institution_id)

    facility_id = payload.get("facility_id")
    if facility_id:
        try:
            facility_id = int(facility_id)
        except (TypeError, ValueError):
            return Response({"error": "Invalid facility id"}, status=status.HTTP_400_BAD_REQUEST)
        queryset = queryset.filter(facility_id=facility_id)

    incident_type = (payload.get("incident_type") or "").strip()

    date_from = None
    date_to = None
    if incident_type:
        queryset = queryset.filter(incident_type=incident_type)

    date_from_raw = payload.get("date_from")
    if date_from_raw:
        date_from = parse_date(date_from_raw)
        if not date_from:
            return Response({"error": "Invalid date_from"}, status=status.HTTP_400_BAD_REQUEST)
        queryset = queryset.filter(occurred_at__date__gte=date_from)

    date_to_raw = payload.get("date_to")
    if date_to_raw:
        date_to = parse_date(date_to_raw)
        if not date_to:
            return Response({"error": "Invalid date_to"}, status=status.HTTP_400_BAD_REQUEST)
        queryset = queryset.filter(occurred_at__date__lte=date_to)

    target_institutions = _institutions_for_ai_request(
        queryset,
        institution_id=institution_id,
        facility_id=facility_id,
    )
    usage_summary = []
    for institution in target_institutions:
        try:
            assert_ai_feature_enabled(institution)
            usage = assert_ai_usage_available(institution)
            usage_summary.append(
                {
                    "institution_id": institution.id,
                    "institution_name": institution.name,
                    **usage,
                }
            )
        except BillingLimitError as exc:
            return Response(
                {"error": f"{institution.name}: {exc}"},
                status=status.HTTP_403_FORBIDDEN,
            )

    try:
        max_records = int(payload.get("max_records") or 50)
    except (TypeError, ValueError):
        return Response({"error": "max_records must be a number"}, status=status.HTTP_400_BAD_REQUEST)

    max_records = max(1, min(max_records, 100))
    incidents = list(queryset.order_by("-occurred_at")[:max_records])

    analytics = _build_ai_analytics(queryset, date_from=date_from, date_to=date_to)
    filters = {
        "institution_id": institution_hash or None,
        "facility_id": facility_id if facility_id else None,
        "incident_type": incident_type or None,
        "date_from": date_from_raw or None,
        "date_to": date_to_raw or None,
        "max_records": max_records,
    }

    if not incidents:
        return Response(
            {
                "insights": INCIDENT_ANALYTICS_FALLBACK,
                "meta": {
                    "incident_count": 0,
                    "filters": filters,
                    "model": None,
                    "usage": usage_summary,
                },
                "analytics": analytics,
            },
            status=status.HTTP_200_OK,
        )

    actor_label = request.user.username or f"user-{request.user.id}"
    try:
        insights = generate_incident_insights(
            incidents=incidents,
            filters=filters,
            actor_label=actor_label,
        )
    except IncidentInsightsError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    updated_usage_summary = []
    for institution in target_institutions:
        increment_feature_usage(institution, FEATURE_MAX_AI_QUERIES_PER_MONTH)
        updated_usage_summary.append(
            {
                "institution_id": institution.id,
                "institution_name": institution.name,
                **get_ai_usage_summary(institution),
            }
        )

    return Response(
        {
            "insights": insights,
            "meta": {
                "incident_count": len(incidents),
                "filters": filters,
                "model": getattr(settings, "OPENAI_INCIDENT_INSIGHTS_MODEL", None),
                "usage": updated_usage_summary,
            },
            "analytics": analytics,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def incident_area_analysis_api(request):
    payload = request.data or {}
    location_hint = (payload.get("location_hint") or "").strip()
    focus_term = (payload.get("focus_term") or payload.get("subject") or "").strip()
    try:
        live_intel_limit = int(payload.get("live_intel_limit") or 5)
    except (TypeError, ValueError):
        return Response({"error": "live_intel_limit must be a number"}, status=status.HTTP_400_BAD_REQUEST)
    live_intel_limit = max(1, min(live_intel_limit, 8))

    try:
        center_lat = _parse_float(payload.get("center_latitude"), field_name="center_latitude")
        center_lng = _parse_float(payload.get("center_longitude"), field_name="center_longitude")
        radius_km = _parse_float(payload.get("radius_km"), field_name="radius_km")
    except ValueError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    if radius_km <= 0:
        return Response({"error": "radius_km must be greater than zero"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        institution = _resolve_area_analysis_institution(request.user, payload.get("institution_id"))
    except PermissionError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_403_FORBIDDEN)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    facilities_qs = SecurityFacility.objects.all()
    incidents_qs = _incident_scope_for_user(request.user).select_related("facility", "institution").distinct()

    if institution is not None:
        facilities_qs = facilities_qs.filter(institution=institution)
        incidents_qs = incidents_qs.filter(
            Q(institution=institution) | Q(facility__institution=institution)
        )
    elif not is_site_admin(request.user):
        allowed_ids = institution_ids_for_user(request.user)
        facilities_qs = facilities_qs.filter(institution_id__in=allowed_ids)
        incidents_qs = incidents_qs.filter(
            Q(institution_id__in=allowed_ids) | Q(facility__institution_id__in=allowed_ids)
        )

    facilities = []
    for facility in facilities_qs.select_related("institution").order_by("name"):
        latitude = float(facility.latitude)
        longitude = float(facility.longitude)
        distance_km = haversine_km(center_lat, center_lng, latitude, longitude)
        if distance_km > radius_km:
            continue
        facilities.append(
            {
                "id": facility.id,
                "name": facility.name,
                "institution_id": facility.institution_id,
                "institution_name": facility.institution.name if facility.institution_id and facility.institution else "",
                "facility_type": facility.facility_type,
                "county": facility.county,
                "sub_county": facility.sub_county,
                "latitude": latitude,
                "longitude": longitude,
                "active": facility.active,
                "distance_km": round(distance_km, 2),
            }
        )

    incidents = []
    for incident in incidents_qs.order_by("-occurred_at"):
        latitude = float(incident.latitude)
        longitude = float(incident.longitude)
        distance_km = haversine_km(center_lat, center_lng, latitude, longitude)
        if distance_km > radius_km:
            continue
        institution_name = ""
        if incident.institution_id and incident.institution:
            institution_name = incident.institution.name
        elif incident.facility_id and incident.facility and incident.facility.institution_id:
            institution_name = incident.facility.institution.name
        incidents.append(
            {
                "id": incident.id,
                "ob_number": incident.ob_number,
                "incident_type": incident.incident_type,
                "description": incident.description,
                "facility_name": incident.facility.name if incident.facility_id and incident.facility else "",
                "institution_name": institution_name,
                "follow_up_status": incident.follow_up_status,
                "occurred_at": incident.occurred_at.isoformat() if incident.occurred_at else "",
                "latitude": latitude,
                "longitude": longitude,
                "distance_km": round(distance_km, 2),
            }
        )

    context = {
        "actor": request.user.username,
        "institution": institution.name if institution else "All visible institutions",
        "center": {"latitude": center_lat, "longitude": center_lng},
        "radius_km": round(radius_km, 2),
        "facilities_count": len(facilities),
        "incidents_count": len(incidents),
        "facilities": facilities[:20],
        "incidents": incidents[:30],
    }
    analysis, used_fallback = generate_area_analysis(context=context)

    risk_counts = {
        "facilities": len(facilities),
        "incidents": len(incidents),
        "open_incidents": len([item for item in incidents if item["follow_up_status"] != "resolved"]),
        "active_facilities": len([item for item in facilities if item["active"]]),
    }

    location_source = location_hint
    if not location_source and facilities:
        nearest_facility = min(facilities, key=lambda item: item["distance_km"])
        location_source = nearest_facility.get("sub_county") or nearest_facility.get("county") or nearest_facility.get("name")
    if not location_source and incidents:
        location_source = incidents[0].get("facility_name") or incidents[0].get("institution_name")
    if not location_source:
        location_source = f"{center_lat:.5f},{center_lng:.5f}"

    try:
        live_intel = fetch_area_news(
            location_hint=location_source,
            focus_term=focus_term,
            limit=live_intel_limit,
        )
    except AreaAnalysisError as exc:
        live_intel = {
            "query": "",
            "articles": [],
            "error": str(exc),
        }
    live_intel["focus_term"] = focus_term
    live_intel["location_hint"] = location_source
    live_intel["generated_at"] = timezone.now().isoformat()

    return Response(
        {
            "center": {"latitude": center_lat, "longitude": center_lng},
            "radius_km": round(radius_km, 2),
            "institution": (
                {"id": institution.id, "name": institution.name}
                if institution is not None
                else None
            ),
            "counts": risk_counts,
            "facilities": facilities,
            "incidents": incidents,
            "analysis": analysis,
            "live_intel": live_intel,
            "meta": {
                "used_fallback": used_fallback,
                "model": getattr(settings, "OPENAI_INCIDENT_INSIGHTS_MODEL", None),
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def incident_news_links_api(request, pk):
    decoded_id = decode_id(pk)
    if not decoded_id:
        return Response({"error": "Invalid incident id"}, status=status.HTTP_404_NOT_FOUND)

    incident = _incident_scope_for_user(request.user).select_related("facility", "institution").filter(id=decoded_id).first()
    if incident is None:
        return Response({"error": "Incident not found"}, status=status.HTTP_404_NOT_FOUND)

    try:
        payload = fetch_incident_news(incident=incident, limit=int(request.data.get("limit") or 5))
    except (AreaAnalysisError, ValueError) as exc:
        return Response({"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    return Response(payload, status=status.HTTP_200_OK)


@api_view(["POST"])
def public_incident_report_api(request):
    serializer = PublicIncidentReportSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    image_analysis = None
    uploaded_image = data.get("image")
    if uploaded_image is not None:
        uploaded_image.seek(0)
        try:
            image_analysis = analyze_public_incident_image(
                image_bytes=uploaded_image.read(),
                mime_type=getattr(uploaded_image, "content_type", "image/jpeg") or "image/jpeg",
            )
        except PublicIncidentMatchError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    incident_type = data.get("incident_type") or (image_analysis or {}).get("incident_type") or "other"
    description = (data.get("description") or "").strip() or (image_analysis or {}).get("description", "").strip()
    location_hint = (data.get("public_location_hint") or "").strip() or (image_analysis or {}).get("location_hint", "").strip()
    latitude = data.get("latitude")
    longitude = data.get("longitude")

    if not description:
        return Response(
            {"error": "The report needs more detail. Add a description or a clearer image."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    match_input = {
        "incident_type": incident_type,
        "description": description,
        "location_hint": location_hint,
        "latitude": float(latitude) if latitude is not None else None,
        "longitude": float(longitude) if longitude is not None else None,
        "occurred_at": data["occurred_at"].isoformat(),
    }

    try:
        match = generate_public_incident_match(incident_payload=match_input)
    except PublicIncidentMatchError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    if not match.get("match_found") or not match.get("institution_id"):
        return Response(
            {
                "matched": False,
                "message": match.get("public_message") or "We could not match this report to an institution in the platform.",
                "reason": match.get("reason") or "",
                "analysis": image_analysis,
            },
            status=status.HTTP_200_OK,
        )

    institution = Institution.objects.filter(id=match["institution_id"]).first()
    if institution is None:
        return Response(
            {
                "matched": False,
                "message": "We could not match this report to an institution in the platform.",
                "reason": "Matched institution no longer exists.",
            },
            status=status.HTTP_200_OK,
        )

    facility = None
    if match.get("facility_id"):
        facility = SecurityFacility.objects.filter(id=match["facility_id"], institution=institution).first()

    if facility is None:
        return Response(
            {
                "matched": False,
                "message": "We found no relevant facility for this report yet.",
                "reason": match.get("reason") or "No facility had enough evidence to receive the case.",
                "analysis": image_analysis,
            },
            status=status.HTTP_200_OK,
        )

    incident_latitude = latitude if latitude is not None else facility.latitude
    incident_longitude = longitude if longitude is not None else facility.longitude

    incident = Incident.objects.create(
        ob_number=_generate_public_ob_number(),
        incident_type=incident_type,
        description=description,
        facility=facility,
        institution=institution,
        latitude=incident_latitude,
        longitude=incident_longitude,
        occurred_at=data["occurred_at"],
        source=Incident.SOURCE_PUBLIC,
        reporter_name=data.get("reporter_name", ""),
        reporter_contact=data.get("reporter_contact", ""),
        public_location_hint=location_hint,
    )

    return Response(
        {
            "matched": True,
            "message": match.get("public_message") or f'Your report has been routed to {institution.name}.',
            "reason": match.get("reason") or "",
            "match": {
                "institution_name": institution.name,
                "facility_name": facility.name if facility else "",
                "confidence": match.get("confidence") or "medium",
            },
            "incident": {
                "id": incident.id,
                "reference": incident.ob_number,
                "institution_name": institution.name,
                "facility_name": facility.name if facility else "",
            },
            "analysis": image_analysis,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
def public_incident_inquiry_api(request):
    serializer = PublicIncidentInquirySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    reference = serializer.validated_data["reference"]
    reporter_contact = serializer.validated_data["reporter_contact"]

    incident = _public_incident_scope_for_inquiry(reference, reporter_contact).first()
    if incident is None:
        return Response(
            {
                "found": False,
                "message": "No matching public incident was found for the reference and contact provided.",
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    nearby_incidents = []
    for item in Incident.objects.filter(
        source=Incident.SOURCE_PUBLIC,
        institution_id=incident.institution_id,
        occurred_at__gte=timezone.now() - timedelta(days=3),
    ).exclude(id=incident.id).select_related("facility").order_by("-occurred_at")[:8]:
        nearby_incidents.append(
            {
                "reference": item.ob_number,
                "incident_type": item.incident_type,
                "status": item.follow_up_status,
                "facility_name": item.facility.name if item.facility_id and item.facility else "",
                "occurred_at": item.occurred_at.isoformat() if item.occurred_at else "",
            }
        )

    location_hint = incident.public_location_hint
    if not location_hint and incident.facility_id and incident.facility:
        location_hint = incident.facility.sub_county or incident.facility.county or incident.facility.name

    focus_term = incident.incident_type.replace("_", " ")
    try:
        live_intel = fetch_area_news(location_hint=location_hint, focus_term=focus_term, limit=5)
    except AreaAnalysisError as exc:
        live_intel = {
            "query": "",
            "articles": [],
            "error": str(exc),
        }
    live_intel["generated_at"] = timezone.now().isoformat()
    live_intel["location_hint"] = location_hint or ""

    return Response(
        {
            "found": True,
            "incident": _serialize_public_incident_for_inquiry(incident),
            "nearby_recent_incidents": nearby_incidents,
            "live_intel": live_intel,
        },
        status=status.HTTP_200_OK,
    )






