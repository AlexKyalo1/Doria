import json
from urllib import error, request

from django.conf import settings


class IncidentInsightsError(Exception):
    pass


INCIDENT_INSIGHTS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "summary": {"type": "string"},
        "risk_level": {"type": "string", "enum": ["low", "medium", "high"]},
        "top_patterns": {
            "type": "array",
            "items": {"type": "string"},
            "maxItems": 5,
        },
        "priority_actions": {
            "type": "array",
            "items": {"type": "string"},
            "maxItems": 5,
        },
        "follow_up_gaps": {
            "type": "array",
            "items": {"type": "string"},
            "maxItems": 5,
        },
        "incident_breakdown": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "incident_type": {"type": "string"},
                    "count": {"type": "integer"},
                },
                "required": ["incident_type", "count"],
            },
            "maxItems": 10,
        },
        "facility_hotspots": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "facility_name": {"type": "string"},
                    "incident_count": {"type": "integer"},
                },
                "required": ["facility_name", "incident_count"],
            },
            "maxItems": 5,
        },
        "recommended_queries": {
            "type": "array",
            "items": {"type": "string"},
            "maxItems": 4,
        },
    },
    "required": [
        "summary",
        "risk_level",
        "top_patterns",
        "priority_actions",
        "follow_up_gaps",
        "incident_breakdown",
        "facility_hotspots",
        "recommended_queries",
    ],
}


SYSTEM_PROMPT = (
    "You analyze incident data for a security operations platform. "
    "Use only the provided data. Do not invent incidents, facilities, or trends. "
    "Return concise operational insights for human review."
)


def _serialize_incident(incident):
    return {
        "id": incident.id,
        "ob_number": incident.ob_number,
        "incident_type": incident.incident_type,
        "description": incident.description,
        "facility_name": incident.facility.name if incident.facility_id else None,
        "institution_name": incident.institution.name if incident.institution_id else None,
        "occurred_at": incident.occurred_at.isoformat() if incident.occurred_at else None,
        "reported_at": incident.reported_at.isoformat() if incident.reported_at else None,
        "follow_up_status": incident.follow_up_status,
        "follow_up_note": incident.follow_up_note,
        "latitude": str(incident.latitude),
        "longitude": str(incident.longitude),
    }


def _extract_text(payload):
    if isinstance(payload.get("output_text"), str) and payload["output_text"].strip():
        return payload["output_text"]

    for item in payload.get("output", []):
        for content in item.get("content", []):
            text = content.get("text") or content.get("output_text")
            if isinstance(text, str) and text.strip():
                return text
    raise IncidentInsightsError("OpenAI response did not include structured text output")


def generate_incident_insights(*, incidents, filters, actor_label):
    api_key = getattr(settings, "OPENAI_API_KEY", "")
    if not api_key:
        raise IncidentInsightsError("OPENAI_API_KEY is not configured on the server")

    api_base = getattr(settings, "OPENAI_API_BASE", "https://api.openai.com/v1").rstrip("/")
    model = getattr(settings, "OPENAI_INCIDENT_INSIGHTS_MODEL", "gpt-4o-mini")

    serialized_incidents = [_serialize_incident(incident) for incident in incidents]
    user_payload = {
        "actor": actor_label,
        "filters": filters,
        "incident_count": len(serialized_incidents),
        "incidents": serialized_incidents,
    }

    body = {
        "model": model,
        "input": [
            {
                "role": "system",
                "content": [{"type": "input_text", "text": SYSTEM_PROMPT}],
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": json.dumps(user_payload)}],
            },
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "incident_insights",
                "schema": INCIDENT_INSIGHTS_SCHEMA,
                "strict": True,
            }
        },
    }

    http_request = request.Request(
        url=f"{api_base}/responses",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(http_request, timeout=45) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise IncidentInsightsError(f"OpenAI request failed: {details or exc.reason}") from exc
    except error.URLError as exc:
        raise IncidentInsightsError(f"OpenAI connection failed: {exc.reason}") from exc

    try:
        return json.loads(_extract_text(payload))
    except json.JSONDecodeError as exc:
        raise IncidentInsightsError("OpenAI returned malformed JSON for incident insights") from exc
