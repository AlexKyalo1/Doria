function getApiOrigin() {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:8000";
  }

  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const hostname = window.location.hostname || "127.0.0.1";
  return `${protocol}//${hostname}:8000`;
}

export const API_ORIGIN = getApiOrigin();
export const API_BASE = `${API_ORIGIN}/api`;
export const ACCOUNTS_API_BASE = `${API_BASE}/accounts`;
export const SECURITY_API_BASE = `${API_BASE}/security`;
export const INCIDENTS_API_BASE = `${API_BASE}/incidents`;
export const CHAT_API_BASE = `${API_BASE}/chat`;
export const BILLING_API_BASE = `${API_BASE}/billing`;
