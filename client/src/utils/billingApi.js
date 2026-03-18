import { apiFetch } from "./apiFetch";

export const BILLING_API_BASE = "http://127.0.0.1:8000/api/billing";
export const ACCOUNTS_API_BASE = "http://127.0.0.1:8000/api/accounts";

export function buildAuthHeaders(token, extra = {}) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

export async function readJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function fetchPlans(headers) {
  const response = await apiFetch(`${BILLING_API_BASE}/plans/`, {
    method: "GET",
    headers,
  });
  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(data.error || "Failed to load billing plans.");
  }
  return data.plans || [];
}

export async function fetchBillingSnapshot(institutionId, headers) {
  const response = await apiFetch(`${BILLING_API_BASE}/institutions/${institutionId}/`, {
    method: "GET",
    headers,
  });
  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(data.error || "Failed to load billing details.");
  }
  return data;
}

export async function createCheckoutSession(institutionId, headers, payload) {
  const response = await apiFetch(`${BILLING_API_BASE}/institutions/${institutionId}/checkout/`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(data.error || "Failed to start checkout.");
  }
  return data;
}

export async function updateInstitutionSubscription(institutionId, headers, payload) {
  const response = await apiFetch(`${BILLING_API_BASE}/admin/institutions/${institutionId}/subscription/`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(data.error || "Failed to update subscription.");
  }
  return data;
}

export async function updateInstitutionOverrides(institutionId, headers, payload) {
  const response = await apiFetch(`${BILLING_API_BASE}/admin/institutions/${institutionId}/overrides/`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(data.error || "Failed to update overrides.");
  }
  return data;
}

export async function fetchInstitutionEvents(institutionId, headers) {
  const response = await apiFetch(`${BILLING_API_BASE}/admin/institutions/${institutionId}/events/`, {
    method: "GET",
    headers,
  });
  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(data.error || "Failed to load payment events.");
  }
  return data.events || [];
}

export async function fetchInstitutions(headers) {
  const response = await apiFetch(`${ACCOUNTS_API_BASE}/institutions/`, {
    method: "GET",
    headers,
  });
  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(data.error || "Failed to load institutions.");
  }
  return data.institutions || [];
}

export async function fetchAdminInstitutions(headers) {
  const response = await apiFetch(`${BILLING_API_BASE}/admin/institutions/`, {
    method: "GET",
    headers,
  });
  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(data.error || "Failed to load institutions.");
  }
  return data.institutions || [];
}

export async function fetchProfile(headers) {
  const response = await apiFetch(`${ACCOUNTS_API_BASE}/profile/`, {
    method: "GET",
    headers,
  });
  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(data.error || "Failed to load profile.");
  }
  return data.user || null;
}
