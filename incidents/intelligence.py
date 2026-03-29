import json
import math
from email.utils import parsedate_to_datetime
from urllib import error, parse, request
from xml.etree import ElementTree

from django.conf import settings


class AreaAnalysisError(Exception):
    pass


AREA_ANALYSIS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "summary": {"type": "string"},
        "risk_level": {"type": "string", "enum": ["low", "medium", "high"]},
        "deployment_posture": {"type": "string"},
        "facility_observations": {
            "type": "array",
            "items": {"type": "string"},
            "maxItems": 5,
        },
        "incident_observations": {
            "type": "array",
            "items": {"type": "string"},
            "maxItems": 5,
        },
        "recommended_actions": {
            "type": "array",
            "items": {"type": "string"},
            "maxItems": 5,
        },
    },
    "required": [
        "summary",
        "risk_level",
        "deployment_posture",
        "facility_observations",
        "incident_observations",
        "recommended_actions",
    ],
}


AREA_SYSTEM_PROMPT = (
    "You analyze facilities and incidents inside a draggable geofence for security operations teams. "
    "Use only the supplied data. Do not invent facilities, incidents, coverage gaps, or actions. "
    "Return concise operational guidance suitable for a human incident commander."
)


def _extract_text(payload):
    if isinstance(payload.get("output_text"), str) and payload["output_text"].strip():
        return payload["output_text"]

    for item in payload.get("output", []):
        for content in item.get("content", []):
            text = content.get("text") or content.get("output_text")
            if isinstance(text, str) and text.strip():
                return text
    raise AreaAnalysisError("OpenAI response did not include structured text output")


def _extract_chat_text(payload):
    choices = payload.get("choices") or []
    if not choices:
        raise AreaAnalysisError("OpenAI response did not include choices")
    message = choices[0].get("message") or {}
    content = message.get("content")
    if isinstance(content, str) and content.strip():
        return content
    raise AreaAnalysisError("OpenAI response did not include message content")


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


def fallback_area_analysis(*, context):
    facilities = context.get("facilities") or []
    incidents = context.get("incidents") or []
    radius_km = float(context.get("radius_km") or 0)
    open_incidents = [item for item in incidents if item.get("follow_up_status") != "resolved"]
    active_facilities = [item for item in facilities if item.get("active")]
    incident_types = {}
    for incident in incidents:
        incident_type = incident.get("incident_type") or "other"
        incident_types[incident_type] = incident_types.get(incident_type, 0) + 1
    top_type = max(incident_types, key=incident_types.get) if incident_types else None

    if len(open_incidents) >= 4 or len(incidents) >= 6:
        risk_level = "high"
    elif len(open_incidents) >= 2 or len(incidents) >= 3:
        risk_level = "medium"
    else:
        risk_level = "low"

    if not facilities and not incidents:
        return {
            "summary": "No facilities or incidents were found inside the selected area.",
            "risk_level": "low",
            "deployment_posture": "Hold current posture and widen or move the ring if you need a broader operational scan.",
            "facility_observations": ["No facilities were captured inside the current radius."],
            "incident_observations": ["No incidents were captured inside the current radius."],
            "recommended_actions": [
                "Move the ring toward the corridor you want to inspect.",
                "Increase the radius to include nearby facilities and reported cases.",
            ],
        }

    facility_observations = []
    if active_facilities:
        facility_observations.append(f"{len(active_facilities)} active facilities are inside the current area.")
    if len(facilities) > len(active_facilities):
        facility_observations.append(
            f"{len(facilities) - len(active_facilities)} facilities inside the ring are marked inactive."
        )
    if top_type:
        facility_observations.append(
            f"The area is currently anchored around {len(facilities)} facilities while {top_type.replace('_', ' ')} is the dominant visible incident type."
        )

    incident_observations = []
    incident_observations.append(
        f"{len(incidents)} incidents fall within the {radius_km:.1f} km ring, with {len(open_incidents)} still open or in progress."
    )
    if top_type:
        incident_observations.append(
            f"The highest visible concentration is {top_type.replace('_', ' ')} incidents."
        )
    if open_incidents:
        newest = sorted(
            [item for item in open_incidents if item.get("occurred_at")],
            key=lambda item: item["occurred_at"],
            reverse=True,
        )
        if newest:
            incident_observations.append(
                f"The most recent open case is {newest[0].get('ob_number') or 'an unnumbered incident'}."
            )

    recommended_actions = []
    if open_incidents:
        recommended_actions.append("Review unresolved incidents first and verify which facility should own the next follow-up.")
    if len(active_facilities) <= 1 and len(incidents) >= 2:
        recommended_actions.append("Consider widening the ring to identify supporting facilities around the hotspot.")
    if top_type:
        recommended_actions.append(f"Prepare a focused response note for {top_type.replace('_', ' ')} trends in this corridor.")
    if not recommended_actions:
        recommended_actions.append("Keep the area under observation and compare it against neighboring rings for spillover patterns.")

    deployment_posture = (
        "Escalate visible coordination checks across nearby facilities."
        if risk_level == "high"
        else "Maintain an active watch with targeted follow-up."
        if risk_level == "medium"
        else "Routine monitoring is adequate unless new incidents enter the ring."
    )

    return {
        "summary": (
            f"The selected area contains {len(facilities)} facilities and {len(incidents)} incidents. "
            f"Current operational risk is {risk_level}."
        ),
        "risk_level": risk_level,
        "deployment_posture": deployment_posture,
        "facility_observations": facility_observations[:5],
        "incident_observations": incident_observations[:5],
        "recommended_actions": recommended_actions[:5],
    }


def generate_area_analysis(*, context):
    api_key = getattr(settings, "OPENAI_API_KEY", "")
    if not api_key:
        return fallback_area_analysis(context=context), True

    api_base = getattr(settings, "OPENAI_API_BASE", "https://api.openai.com/v1").rstrip("/")
    model = getattr(settings, "OPENAI_INCIDENT_INSIGHTS_MODEL", "gpt-4o-mini")
    use_chat_completions = "deepseek" in api_base.lower()

    if use_chat_completions:
        body = {
            "model": model,
            "messages": [
                {"role": "system", "content": AREA_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        "Return ONLY valid JSON matching this schema:\n"
                        f"{json.dumps(AREA_ANALYSIS_SCHEMA)}\n\n"
                        f"Input data:\n{json.dumps(context)}"
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
                {
                    "role": "system",
                    "content": [{"type": "input_text", "text": AREA_SYSTEM_PROMPT}],
                },
                {
                    "role": "user",
                    "content": [{"type": "input_text", "text": json.dumps(context)}],
                },
            ],
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "incident_area_analysis",
                    "schema": AREA_ANALYSIS_SCHEMA,
                    "strict": True,
                }
            },
        }
        endpoint = f"{api_base}/responses"

    http_request = request.Request(
        url=endpoint,
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
        text = _extract_chat_text(payload) if use_chat_completions else _extract_text(payload)
        return _coerce_json(text), False
    except (AreaAnalysisError, json.JSONDecodeError, error.HTTPError, error.URLError):
        return fallback_area_analysis(context=context), True


def _build_news_query(*, incident):
    parts = [
        incident.incident_type.replace("_", " ") if incident.incident_type else "",
        incident.public_location_hint or "",
        incident.facility.name if incident.facility_id and incident.facility else "",
        incident.institution.name if incident.institution_id and incident.institution else "",
        incident.facility.county if incident.facility_id and incident.facility else "",
        "Kenya",
    ]
    cleaned = [part.strip() for part in parts if part and part.strip()]
    return " ".join(cleaned[:5]) or "Kenya security incident"


def _score_article(item, *, incident):
    haystack = f"{item.get('title', '')} {item.get('source', '')}".lower()
    keywords = [
        incident.incident_type.replace("_", " ").lower() if incident.incident_type else "",
        (incident.public_location_hint or "").lower(),
        incident.facility.name.lower() if incident.facility_id and incident.facility else "",
        incident.institution.name.lower() if incident.institution_id and incident.institution else "",
    ]
    score = 0
    for keyword in keywords:
        if keyword and keyword in haystack:
            score += 2 if " " in keyword else 1
    return score


def _fetch_news_by_query(*, query, limit, score_keywords=None):
    rss_url = (
        "https://news.google.com/rss/search?"
        + parse.urlencode({"q": query, "hl": "en-KE", "gl": "KE", "ceid": "KE:en"})
    )

    http_request = request.Request(
        url=rss_url,
        headers={"User-Agent": "Mozilla/5.0"},
        method="GET",
    )

    try:
        with request.urlopen(http_request, timeout=20) as response:
            payload = response.read()
    except (error.HTTPError, error.URLError) as exc:
        raise AreaAnalysisError(f"News feed request failed: {getattr(exc, 'reason', exc)}") from exc

    try:
        root = ElementTree.fromstring(payload)
    except ElementTree.ParseError as exc:
        raise AreaAnalysisError("News feed returned malformed XML") from exc

    articles = []
    for item in root.findall("./channel/item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        source = (item.findtext("source") or "").strip()
        published_at = (item.findtext("pubDate") or "").strip()
        if not title or not link:
            continue
        iso_published = ""
        if published_at:
            try:
                iso_published = parsedate_to_datetime(published_at).isoformat()
            except (TypeError, ValueError, IndexError, OverflowError):
                iso_published = published_at
        entry = {
            "title": title,
            "link": link,
            "source": source or "Google News",
            "published_at": iso_published,
        }
        score = 0
        haystack = f"{entry['title']} {entry['source']}".lower()
        for keyword in score_keywords or []:
            normalized = (keyword or "").strip().lower()
            if not normalized:
                continue
            if normalized in haystack:
                score += 2 if " " in normalized else 1
        entry["score"] = score
        articles.append(entry)

    articles.sort(key=lambda item: (item["score"], item.get("published_at", "")), reverse=True)
    trimmed = []
    seen_links = set()
    for article in articles:
        if article["link"] in seen_links:
            continue
        seen_links.add(article["link"])
        trimmed.append(
            {
                "title": article["title"],
                "link": article["link"],
                "source": article["source"],
                "published_at": article["published_at"],
                "matching_signal": "High match" if article["score"] >= 3 else "Possible lead",
            }
        )
        if len(trimmed) >= max(1, min(limit, 8)):
            break
    return {"query": query, "articles": trimmed}


def fetch_incident_news(*, incident, limit=5):
    query = _build_news_query(incident=incident)
    score_keywords = [
        incident.incident_type.replace("_", " ") if incident.incident_type else "",
        incident.public_location_hint or "",
        incident.facility.name if incident.facility_id and incident.facility else "",
        incident.institution.name if incident.institution_id and incident.institution else "",
    ]
    return _fetch_news_by_query(query=query, limit=limit, score_keywords=score_keywords)


def fetch_area_news(*, location_hint="", focus_term="", limit=5):
    parts = [
        (focus_term or "").strip(),
        "security",
        (location_hint or "").strip(),
        "Kenya",
    ]
    query = " ".join([part for part in parts if part]).strip() or "Kenya security update"
    score_keywords = [focus_term, location_hint, "security", "incident"]
    return _fetch_news_by_query(query=query, limit=limit, score_keywords=score_keywords)


def haversine_km(lat1, lng1, lat2, lng2):
    radius = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return radius * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))
