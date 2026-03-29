import json
import math
import base64
from urllib import error, request

from django.conf import settings

from security.models import SecurityFacility


class PublicIncidentMatchError(Exception):
    pass


PUBLIC_INCIDENT_MATCH_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "match_found": {"type": "boolean"},
        "institution_id": {"type": ["integer", "null"]},
        "facility_id": {"type": ["integer", "null"]},
        "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
        "reason": {"type": "string"},
        "public_message": {"type": "string"},
    },
    "required": ["match_found", "institution_id", "facility_id", "confidence", "reason", "public_message"],
}

PUBLIC_INCIDENT_IMAGE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "incident_type": {
            "type": ["string", "null"],
            "enum": ["robbery", "assault", "accident", "missing_person", "murder", "theft", "other", None],
        },
        "description": {"type": "string"},
        "location_hint": {"type": "string"},
        "visible_signals": {
            "type": "array",
            "items": {"type": "string"},
            "maxItems": 6,
        },
    },
    "required": ["incident_type", "description", "location_hint", "visible_signals"],
}


SYSTEM_PROMPT = (
    "You match public incident reports to the most relevant institution in a Kenyan security platform. "
    "Use only the candidate institutions and facilities provided. "
    "Return a match only when the location or text evidence is reasonably strong. "
    "If there is not enough evidence, return match_found=false. "
    "Return JSON only."
)

IMAGE_SYSTEM_PROMPT = (
    "You analyze a public incident image for a Kenyan security intake workflow. "
    "Only describe what is visually supportable. "
    "Do not invent street names, institutions, or hidden facts. "
    "Return concise structured extraction for downstream incident matching."
)


def _extract_text(payload):
    if isinstance(payload.get("output_text"), str) and payload["output_text"].strip():
        return payload["output_text"]
    for item in payload.get("output", []):
        for content in item.get("content", []):
            text = content.get("text") or content.get("output_text")
            if isinstance(text, str) and text.strip():
                return text
    raise PublicIncidentMatchError("AI response did not include structured text output")


def _extract_chat_text(payload):
    choices = payload.get("choices") or []
    if not choices:
        raise PublicIncidentMatchError("AI response did not include choices")
    message = choices[0].get("message") or {}
    content = message.get("content")
    if isinstance(content, str) and content.strip():
        return content
    raise PublicIncidentMatchError("AI response did not include message content")


def _coerce_json(text):
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if len(lines) >= 2 and lines[0].startswith("```"):
            cleaned = "\n".join(lines[1:])
            if cleaned.rstrip().endswith("```"):
                cleaned = cleaned.rstrip()[:-3]
            cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(cleaned[start : end + 1])
        raise


def _distance_km(lat1, lon1, lat2, lon2):
    radius = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius * c


def _normalize_text(value):
    return (value or "").strip().lower()


def _build_candidates(*, description, location_hint, latitude, longitude):
    text_blob = " ".join(filter(None, [_normalize_text(description), _normalize_text(location_hint)]))
    grouped = {}

    for facility in SecurityFacility.objects.select_related("institution").filter(active=True, institution__isnull=False):
        institution = facility.institution
        if institution.id not in grouped:
            grouped[institution.id] = {
                "institution_id": institution.id,
                "institution_name": institution.name,
                "institution_description": institution.description,
                "score": 0,
                "nearest_distance_km": None,
                "facilities": [],
            }

        entry = grouped[institution.id]
        distance_km = None
        if latitude is not None and longitude is not None:
            distance_km = _distance_km(latitude, longitude, float(facility.latitude), float(facility.longitude))
            if entry["nearest_distance_km"] is None or distance_km < entry["nearest_distance_km"]:
                entry["nearest_distance_km"] = round(distance_km, 2)
            if distance_km <= 10:
                entry["score"] += 7
            elif distance_km <= 25:
                entry["score"] += 4
            elif distance_km <= 60:
                entry["score"] += 2

        if facility.name.lower() in text_blob:
            entry["score"] += 8
        if facility.county.lower() in text_blob:
            entry["score"] += 3
        if facility.sub_county and facility.sub_county.lower() in text_blob:
            entry["score"] += 4
        if institution.name.lower() in text_blob:
            entry["score"] += 5

        entry["facilities"].append(
            {
                "facility_id": facility.id,
                "facility_name": facility.name,
                "facility_type": facility.facility_type,
                "county": facility.county,
                "sub_county": facility.sub_county,
                "latitude": float(facility.latitude),
                "longitude": float(facility.longitude),
                "distance_km": round(distance_km, 2) if distance_km is not None else None,
            }
        )

    ranked = sorted(
        grouped.values(),
        key=lambda item: (item["score"], -(item["nearest_distance_km"] or 999999)),
        reverse=True,
    )
    candidates = []
    for item in ranked[:8]:
        item["facilities"] = sorted(
            item["facilities"],
            key=lambda facility: facility["distance_km"] if facility["distance_km"] is not None else 999999,
        )[:5]
        candidates.append(item)
    return candidates


def _fallback_match(candidates):
    if not candidates:
        return {
            "match_found": False,
            "institution_id": None,
            "facility_id": None,
            "confidence": "low",
            "reason": "No institution candidates were available for matching.",
            "public_message": "We could not find a relevant institution for this incident right now.",
        }

    best = candidates[0]
    nearest = best.get("nearest_distance_km")
    if best.get("score", 0) < 6 and (nearest is None or nearest > 25):
        return {
            "match_found": False,
            "institution_id": None,
            "facility_id": None,
            "confidence": "low",
            "reason": "No candidate had enough location or text evidence.",
            "public_message": "We could not match this report to an institution in the platform.",
        }

    top_facility = best["facilities"][0] if best.get("facilities") else None
    return {
        "match_found": True,
        "institution_id": best["institution_id"],
        "facility_id": top_facility["facility_id"] if top_facility and (top_facility.get("distance_km") or 999999) <= 25 else None,
        "confidence": "medium",
        "reason": "Fallback matcher selected the strongest institution candidate.",
        "public_message": f'Your report has been routed to {best["institution_name"]}.',
    }


def generate_public_incident_match(*, incident_payload):
    candidates = _build_candidates(
        description=incident_payload.get("description"),
        location_hint=incident_payload.get("location_hint"),
        latitude=incident_payload.get("latitude"),
        longitude=incident_payload.get("longitude"),
    )

    api_key = getattr(settings, "OPENAI_API_KEY", "")
    if not api_key:
        return _fallback_match(candidates)

    api_base = getattr(settings, "OPENAI_API_BASE", "https://api.openai.com/v1").rstrip("/")
    model = getattr(settings, "OPENAI_INCIDENT_INSIGHTS_MODEL", "gpt-4o-mini")
    use_chat_completions = "deepseek" in api_base.lower()
    user_payload = {"incident": incident_payload, "candidates": candidates}

    if use_chat_completions:
        body = {
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        "Return ONLY valid JSON matching this schema:\n"
                        f"{json.dumps(PUBLIC_INCIDENT_MATCH_SCHEMA)}\n\n"
                        f"Input data:\n{json.dumps(user_payload)}"
                    ),
                },
            ],
            "stream": False,
        }
        endpoint = f"{api_base}/chat/completions"
    else:
        body = {
            "model": model,
            "input": [
                {"role": "system", "content": [{"type": "input_text", "text": SYSTEM_PROMPT}]},
                {"role": "user", "content": [{"type": "input_text", "text": json.dumps(user_payload)}]},
            ],
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "public_incident_match",
                    "schema": PUBLIC_INCIDENT_MATCH_SCHEMA,
                    "strict": True,
                }
            },
        }
        endpoint = f"{api_base}/responses"

    http_request = request.Request(
        url=endpoint,
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )

    try:
        with request.urlopen(http_request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise PublicIncidentMatchError(f"AI request failed: {details or exc.reason}") from exc
    except error.URLError as exc:
        raise PublicIncidentMatchError(f"AI connection failed: {exc.reason}") from exc

    try:
        text = _extract_chat_text(payload) if use_chat_completions else _extract_text(payload)
        return _coerce_json(text)
    except json.JSONDecodeError as exc:
        raise PublicIncidentMatchError("AI returned malformed JSON for public incident matching") from exc


def analyze_public_incident_image(*, image_bytes, mime_type, actor_label="public-reporter"):
    api_key = getattr(settings, "OPENAI_API_KEY", "")
    if not api_key:
        raise PublicIncidentMatchError("OPENAI_API_KEY is not configured on the server")

    api_base = getattr(settings, "OPENAI_API_BASE", "https://api.openai.com/v1").rstrip("/")
    model = getattr(settings, "OPENAI_INCIDENT_INSIGHTS_MODEL", "gpt-4o-mini")
    encoded_image = base64.b64encode(image_bytes).decode("ascii")
    data_url = f"data:{mime_type};base64,{encoded_image}"

    body = {
        "model": model,
        "input": [
            {
                "role": "system",
                "content": [{"type": "input_text", "text": IMAGE_SYSTEM_PROMPT}],
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": json.dumps(
                            {
                                "actor": actor_label,
                                "instruction": "Infer incident type, short description, and any visible location hint from this image only.",
                            }
                        ),
                    },
                    {
                        "type": "input_image",
                        "image_url": data_url,
                    },
                ],
            },
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "public_incident_image",
                "schema": PUBLIC_INCIDENT_IMAGE_SCHEMA,
                "strict": True,
            }
        },
    }
    endpoint = f"{api_base}/responses"

    http_request = request.Request(
        url=endpoint,
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )

    try:
        with request.urlopen(http_request, timeout=45) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise PublicIncidentMatchError(f"AI request failed: {details or exc.reason}") from exc
    except error.URLError as exc:
        raise PublicIncidentMatchError(f"AI connection failed: {exc.reason}") from exc

    try:
        text = _extract_text(payload)
        return _coerce_json(text)
    except json.JSONDecodeError as exc:
        raise PublicIncidentMatchError("AI returned malformed JSON for public incident image analysis") from exc
