import json
from urllib import error, request

from django.conf import settings


class AdminAssistantError(Exception):
    pass


ADMIN_ASSISTANT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "summary": {"type": "string"},
        "operator_response": {"type": "string"},
        "requires_clarification": {"type": "boolean"},
        "clarification_question": {"type": "string"},
        "actions": {
            "type": "array",
            "maxItems": 5,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "action_type": {
                        "type": "string",
                        "enum": [
                            "answer_only",
                            "list_users",
                            "list_institutions",
                            "create_institution",
                            "create_facility",
                            "add_institution_member",
                            "update_user_access",
                            "unblock_ip",
                        ],
                    },
                    "rationale": {"type": "string"},
                    "risk_level": {"type": "string", "enum": ["low", "medium", "high"]},
                    "parameters": {"type": "object"},
                },
                "required": ["action_type", "rationale", "risk_level", "parameters"],
            },
        },
    },
    "required": [
        "summary",
        "operator_response",
        "requires_clarification",
        "clarification_question",
        "actions",
    ],
}

CALL_CENTER_SUGGESTION_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "summary": {"type": "string"},
        "guidance": {"type": "string"},
        "buttons": {
            "type": "array",
            "maxItems": 4,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "label": {"type": "string"},
                    "path": {
                        "type": "string",
                        "enum": [
                            "/incidents",
                            "/incidents/manage",
                            "/facilities",
                            "/facilities/map",
                            "/institutions",
                            "/ai/insights",
                            "/admin/ai-console",
                        ],
                    },
                    "note": {"type": "string"},
                },
                "required": ["label", "path", "note"],
            },
        },
    },
    "required": ["summary", "guidance", "buttons"],
}

CALL_CENTER_REPLY_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "reply": {"type": "string"},
        "buttons": {
            "type": "array",
            "maxItems": 4,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "label": {"type": "string"},
                    "path": {
                        "type": "string",
                        "enum": [
                            "/incidents",
                            "/incidents/manage",
                            "/facilities",
                            "/facilities/map",
                            "/institutions",
                            "/ai/insights",
                            "/admin/ai-console",
                        ],
                    },
                    "note": {"type": "string"},
                },
                "required": ["label", "path", "note"],
            },
        },
    },
    "required": ["reply", "buttons"],
}


SYSTEM_PROMPT = (
    "You are an operations planner for a super admin console inside a security platform. "
    "Convert the operator's request into a safe, structured execution plan. "
    "Use only the supported actions and only when the request is explicit enough. "
    "You may use the recent conversation history to resolve pronouns, follow-up replies, and references to the last request. "
    "Prefer using the history instead of asking the operator to repeat information that already exists in context. "
    "Ask for clarification only when a missing value is truly required to execute a supported action safely. "
    "If you ask for clarification, ask exactly one concise question. "
    "Never invent usernames, institution names, ids, coordinates, or statuses. "
    "Prefer answer_only when the request is informational or unsupported. "
    "Supported actions are: "
    "list_users(query, limit), "
    "list_institutions(query, limit), "
    "create_institution(name, description, owner_username), "
    "create_facility(institution_ref, name, facility_type, county, sub_county, latitude, longitude, active), "
    "add_institution_member(institution_ref, user_ref, role), "
    "update_user_access(user_ref, is_active, is_staff), "
    "unblock_ip(ip_address, block_id). "
    "Return JSON only."
)

CALL_CENTER_SYSTEM_PROMPT = (
    "You are an AI assistant helping a customer care or call center agent inside a security operations platform. "
    "Read the conversation transcript and suggest the next best in-app actions for the agent. "
    "Do not execute anything. Do not promise that any action has been completed. "
    "Base suggestions only on the provided conversation content and metadata. "
    "Prefer fast operational guidance: incident escalation, incident follow-up, facilities review, institution context, map review, or AI insights. "
    "Only return buttons that match the allowed paths in the schema. "
    "Keep guidance concise and practical for an on-call agent. "
    "Return JSON only."
)

CALL_CENTER_REPLY_SYSTEM_PROMPT = (
    "You are an AI copilot inside a call center conversation for a security operations platform. "
    "Reply directly to the agent's latest message using the conversation transcript as context. "
    "Be concise, practical, and operational. "
    "Do not claim to have executed anything. "
    "When useful, include up to 4 quick action buttons using only the allowed app paths in the schema. "
    "Your response should feel like part of the same chat thread. "
    "Return JSON only."
)


def _extract_text(payload):
    if isinstance(payload.get("output_text"), str) and payload["output_text"].strip():
        return payload["output_text"]

    for item in payload.get("output", []):
        for content in item.get("content", []):
            text = content.get("text") or content.get("output_text")
            if isinstance(text, str) and text.strip():
                return text
    raise AdminAssistantError("AI response did not include structured text output")


def _extract_chat_text(payload):
    choices = payload.get("choices") or []
    if not choices:
        raise AdminAssistantError("AI response did not include choices")
    message = choices[0].get("message") or {}
    content = message.get("content")
    if isinstance(content, str) and content.strip():
        return content
    raise AdminAssistantError("AI response did not include message content")


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


def _normalize_history(history):
    if not isinstance(history, list):
        return []

    normalized = []
    for item in history[-12:]:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "").strip().lower()
        text = str(item.get("text") or "").strip()
        if role not in {"operator", "assistant"} or not text:
            continue
        normalized.append({"role": role, "text": text[:4000]})
    return normalized


def _post_json_request(*, api_key, api_base, model, system_prompt, schema, user_payload):
    use_chat_completions = "deepseek" in api_base.lower()

    if use_chat_completions:
        body = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": (
                        "Return ONLY valid JSON matching this schema:\n"
                        f"{json.dumps(schema)}\n\n"
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
                {
                    "role": "system",
                    "content": [{"type": "input_text", "text": system_prompt}],
                },
                {
                    "role": "user",
                    "content": [{"type": "input_text", "text": json.dumps(user_payload)}],
                },
            ],
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "structured_response",
                    "schema": schema,
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
    except error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise AdminAssistantError(f"AI request failed: {details or exc.reason}") from exc
    except error.URLError as exc:
        raise AdminAssistantError(f"AI connection failed: {exc.reason}") from exc

    try:
        text = _extract_chat_text(payload) if use_chat_completions else _extract_text(payload)
        return _coerce_json(text)
    except json.JSONDecodeError as exc:
        raise AdminAssistantError("AI returned malformed JSON") from exc


def generate_admin_assistant_plan(*, prompt, actor_label, history=None):
    api_key = getattr(settings, "OPENAI_API_KEY", "")
    if not api_key:
        raise AdminAssistantError("OPENAI_API_KEY is not configured on the server")

    api_base = getattr(settings, "OPENAI_API_BASE", "https://api.openai.com/v1").rstrip("/")
    model = getattr(settings, "OPENAI_INCIDENT_INSIGHTS_MODEL", "gpt-4o-mini")
    user_payload = {
        "actor": actor_label,
        "request": prompt,
        "history": _normalize_history(history),
        "schema": ADMIN_ASSISTANT_SCHEMA,
    }
    return _post_json_request(
        api_key=api_key,
        api_base=api_base,
        model=model,
        system_prompt=SYSTEM_PROMPT,
        schema=ADMIN_ASSISTANT_SCHEMA,
        user_payload=user_payload,
    )


def generate_call_center_suggestions(*, conversation, actor_label, include_admin_link=False):
    api_key = getattr(settings, "OPENAI_API_KEY", "")
    if not api_key:
        raise AdminAssistantError("OPENAI_API_KEY is not configured on the server")

    api_base = getattr(settings, "OPENAI_API_BASE", "https://api.openai.com/v1").rstrip("/")
    model = getattr(settings, "OPENAI_INCIDENT_INSIGHTS_MODEL", "gpt-4o-mini")

    transcript = []
    for message in conversation.messages.all():
        transcript.append(
            {
                "sender_type": message.sender_type,
                "sender_name": getattr(message, "sender_user_name", "") or "",
                "body": message.body,
                "created_at": message.created_at.isoformat(),
            }
        )

    allowed_paths = [
        "/incidents",
        "/incidents/manage",
        "/facilities",
        "/facilities/map",
        "/institutions",
        "/ai/insights",
    ]
    if include_admin_link:
        allowed_paths.append("/admin/ai-console")

    schema = json.loads(json.dumps(CALL_CENTER_SUGGESTION_SCHEMA))
    schema["properties"]["buttons"]["items"]["properties"]["path"]["enum"] = allowed_paths

    user_payload = {
        "actor": actor_label,
        "conversation": {
            "id": conversation.id,
            "status": conversation.status,
            "subject": conversation.subject,
            "customer_name": conversation.customer_name,
            "customer_contact": conversation.customer_contact,
            "institution_id": conversation.workspace.institution_id,
            "facility_id": conversation.facility_id,
            "incident_id": conversation.incident_id,
            "messages": transcript[-20:],
        },
    }

    return _post_json_request(
        api_key=api_key,
        api_base=api_base,
        model=model,
        system_prompt=CALL_CENTER_SYSTEM_PROMPT,
        schema=schema,
        user_payload=user_payload,
    )


def generate_call_center_reply(*, conversation, actor_label, prompt, include_admin_link=False):
    api_key = getattr(settings, "OPENAI_API_KEY", "")
    if not api_key:
        raise AdminAssistantError("OPENAI_API_KEY is not configured on the server")

    api_base = getattr(settings, "OPENAI_API_BASE", "https://api.openai.com/v1").rstrip("/")
    model = getattr(settings, "OPENAI_INCIDENT_INSIGHTS_MODEL", "gpt-4o-mini")

    transcript = []
    for message in conversation.messages.all():
        transcript.append(
            {
                "sender_type": message.sender_type,
                "body": message.body,
                "metadata": message.metadata or {},
                "created_at": message.created_at.isoformat(),
            }
        )

    allowed_paths = [
        "/incidents",
        "/incidents/manage",
        "/facilities",
        "/facilities/map",
        "/institutions",
        "/ai/insights",
    ]
    if include_admin_link:
        allowed_paths.append("/admin/ai-console")

    schema = json.loads(json.dumps(CALL_CENTER_REPLY_SCHEMA))
    schema["properties"]["buttons"]["items"]["properties"]["path"]["enum"] = allowed_paths

    user_payload = {
        "actor": actor_label,
        "prompt": prompt,
        "conversation": {
            "id": conversation.id,
            "status": conversation.status,
            "subject": conversation.subject,
            "customer_name": conversation.customer_name,
            "customer_contact": conversation.customer_contact,
            "institution_id": conversation.workspace.institution_id,
            "facility_id": conversation.facility_id,
            "incident_id": conversation.incident_id,
            "messages": transcript[-25:],
        },
    }

    return _post_json_request(
        api_key=api_key,
        api_base=api_base,
        model=model,
        system_prompt=CALL_CENTER_REPLY_SYSTEM_PROMPT,
        schema=schema,
        user_payload=user_payload,
    )
