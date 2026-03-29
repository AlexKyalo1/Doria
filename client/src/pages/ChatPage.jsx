import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { apiFetch } from "../utils/apiFetch";
import {
  ACCOUNTS_API_BASE as ACCOUNTS_API,
  CHAT_API_BASE as CHAT_API,
} from "../utils/apiBase";
import { useColorMode } from "../utils/useColorMode";
const STORAGE_KEY = "admin_ai_console_sessions_v1";
const MAX_HISTORY_FOR_API = 12;

const starterPrompts = [
  "Create an institution called Coast Command for user alice.",
  "Add john as admin to Nairobi Central institution.",
  "Create a police post for Westlands under Nairobi Central at latitude -1.267 and longitude 36.811.",
  "List blocked IPs and unblock 41.90.12.4.",
];

function makeSession(title = "New session") {
  const now = new Date().toISOString();
  return {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    createdAt: now,
    updatedAt: now,
    entries: [],
  };
}

function summarizeTitle(message) {
  const cleaned = (message || "").trim().replace(/\s+/g, " ");
  if (!cleaned) return "New session";
  return cleaned.length > 44 ? `${cleaned.slice(0, 44)}...` : cleaned;
}

function loadStoredSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed) || !parsed.length) {
      const initial = makeSession();
      return { sessions: [initial], activeSessionId: initial.id };
    }
    const sessions = parsed
      .filter((item) => item && item.id)
      .map((item) => ({
        id: item.id,
        title: item.title || "Untitled session",
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
        entries: Array.isArray(item.entries)
          ? item.entries.map((entry, index) => ({
              ...entry,
              createdAt: entry?.createdAt || item.updatedAt || item.createdAt || new Date(Date.now() + index).toISOString(),
            }))
          : [],
      }));
    const activeSessionId = sessions[0]?.id || makeSession().id;
    return { sessions, activeSessionId };
  } catch (error) {
    const initial = makeSession();
    return { sessions: [initial], activeSessionId: initial.id };
  }
}

function serializeHistory(entries) {
  return entries
    .filter((entry) => entry.role === "operator" || entry.role === "assistant")
    .slice(-MAX_HISTORY_FOR_API)
    .map((entry) => ({
      role: entry.role,
      text: entry.text,
    }));
}

function formatSessionTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function formatEntryTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function ChatPage() {
  const token = localStorage.getItem("access_token");
  const { theme, isDark } = useColorMode();
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );
  const initialSessionsState = useMemo(() => loadStoredSessions(), []);

  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState("");
  const [sessions, setSessions] = useState(initialSessionsState.sessions);
  const [activeSessionId, setActiveSessionId] = useState(initialSessionsState.activeSessionId);
  const feedRef = useRef(null);

  const parseError = (data, fallback) => {
    if (typeof data?.error === "string") return data.error;
    const firstKey = data ? Object.keys(data)[0] : null;
    const firstValue = firstKey ? data[firstKey] : null;
    if (Array.isArray(firstValue) && firstValue[0]) return `${firstKey}: ${firstValue[0]}`;
    if (typeof firstValue === "string") return `${firstKey}: ${firstValue}`;
    return fallback;
  };

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || sessions[0] || null,
    [sessions, activeSessionId]
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (!activeSession && sessions.length) {
      setActiveSessionId(sessions[0].id);
    }
  }, [activeSession, sessions]);

  useLayoutEffect(() => {
    const feedNode = feedRef.current;
    if (!feedNode) {
      return;
    }
    const scrollToLatest = () => {
      feedNode.scrollTop = feedNode.scrollHeight;
    };

    scrollToLatest();
    const frameId = window.requestAnimationFrame(scrollToLatest);
    return () => window.cancelAnimationFrame(frameId);
  }, [activeSessionId, activeSession?.entries?.length]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await apiFetch(`${ACCOUNTS_API}/profile/`, { method: "GET", headers });
        const data = await res.json();
        if (!res.ok) throw new Error(parseError(data, "Failed to load profile"));
        if (active) setProfile(data.user || null);
      } catch (error) {
        if (active) setBanner(error.message || "Failed to load admin console");
      } finally {
        if (active) setLoadingProfile(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [headers]);

  const updateSession = (sessionId, updater) => {
    setSessions((prev) =>
      prev
        .map((session) => {
          if (session.id !== sessionId) return session;
          const nextSession = updater(session);
          return {
            ...nextSession,
            updatedAt: nextSession.updatedAt || new Date().toISOString(),
          };
        })
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    );
  };

  const createNewSession = () => {
    const next = makeSession();
    setSessions((prev) => [next, ...prev]);
    setActiveSessionId(next.id);
    setPrompt("");
    setBanner("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const message = prompt.trim();
    if (!message || !activeSession) return;

    const operatorEntry = {
      id: `${Date.now()}-operator`,
      role: "operator",
      text: message,
      createdAt: new Date().toISOString(),
    };

    setSubmitting(true);
    setBanner("");

    const baseEntries = [...activeSession.entries, operatorEntry];
    updateSession(activeSession.id, (session) => ({
      ...session,
      title: session.entries.length ? session.title : summarizeTitle(message),
      entries: baseEntries,
      updatedAt: new Date().toISOString(),
    }));

    try {
      const res = await apiFetch(`${CHAT_API}/admin/assistant/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message,
          history: serializeHistory(activeSession.entries),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(parseError(data, "Failed to run admin assistant"));

      const assistantEntry = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: data.operator_response || data.summary || "Done.",
        createdAt: new Date().toISOString(),
        summary: data.summary || "",
        requiresClarification: Boolean(data.requires_clarification),
        clarificationQuestion: data.clarification_question || "",
        actions: data.actions || [],
        results: data.results || [],
        buttons: data.buttons || [],
      };

      updateSession(activeSession.id, (session) => ({
        ...session,
        entries: [...session.entries, assistantEntry],
        updatedAt: new Date().toISOString(),
      }));
      setPrompt("");
    } catch (error) {
      setBanner(error.message || "Failed to run admin assistant");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingProfile) {
    return <div style={{ color: theme.text }}>Loading admin AI console...</div>;
  }

  if (!profile?.is_superuser) {
    return (
      <div style={{ ...styles.lockedCard, backgroundColor: theme.cardBg, borderColor: theme.cardBorder, color: theme.text }}>
        <h1 style={styles.title}>Admin AI Console</h1>
        <p style={{ ...styles.subtle, color: theme.mutedText }}>
          This console is restricted to super admins because it can execute backend operations.
        </p>
      </div>
    );
  }

  return (
    <div style={{ ...styles.page, color: theme.text }}>
      <section
        style={{
          ...styles.hero,
          background: isDark
            ? "linear-gradient(135deg, #111827 0%, #0f3d2e 100%)"
            : "linear-gradient(135deg, #ecfccb 0%, #dcfce7 55%, #f0fdf4 100%)",
          borderColor: theme.cardBorder,
        }}
      >
        <div style={styles.heroCopy}>
          <p style={{ ...styles.kicker, color: isDark ? "#bbf7d0" : "#166534" }}>Super Admin</p>
          <h1 style={styles.title}>AI backend operations console</h1>
          <p style={{ ...styles.subtle, color: isDark ? "#d1fae5" : "#166534" }}>
            Work in separate sessions and keep follow-up prompts tied to the currently opened thread only.
          </p>
        </div>
        <div
          style={{
            ...styles.identityCard,
            backgroundColor: isDark ? "rgba(15, 23, 42, 0.72)" : "rgba(255, 255, 255, 0.78)",
            borderColor: isDark ? "#1f2937" : "#bbf7d0",
          }}
        >
          <span style={styles.identityLabel}>Operator</span>
          <strong>{profile.first_name || profile.username}</strong>
          <span style={styles.identityTag}>Super Admin</span>
        </div>
      </section>

      {banner ? <div style={styles.errorBanner}>{banner}</div> : null}

      <div style={styles.layout}>
        <section style={{ ...styles.sessionCard, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.sessionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Sessions</h2>
              <p style={{ ...styles.subtle, color: theme.mutedText }}>
                Start a new thread or reopen a previous one.
              </p>
            </div>
            <button type="button" onClick={createNewSession} style={styles.secondaryButton}>
              New session
            </button>
          </div>

          <div style={styles.sessionList}>
            {sessions.map((session) => {
              const isActive = session.id === activeSession?.id;
              const preview = session.entries[session.entries.length - 1]?.text || "No messages yet";
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => {
                    setActiveSessionId(session.id);
                    setBanner("");
                  }}
                  style={{
                    ...styles.sessionItem,
                    backgroundColor: isActive ? (isDark ? "#0f172a" : "#f0fdf4") : "transparent",
                    borderColor: isActive ? "#166534" : theme.cardBorder,
                    color: theme.text,
                  }}
                >
                  <div style={styles.sessionItemTop}>
                    <strong style={styles.sessionTitle}>{session.title}</strong>
                    {isActive ? <span style={styles.sessionBadge}>Open</span> : null}
                  </div>
                  <div style={{ ...styles.sessionMeta, color: theme.mutedText }}>{formatSessionTime(session.updatedAt)}</div>
                  <div style={{ ...styles.sessionPreview, color: theme.mutedText }}>{preview}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section style={{ ...styles.workspaceCard, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.feedHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Current session</h2>
              <span style={{ ...styles.subtle, color: theme.mutedText }}>
                {activeSession ? activeSession.title : "No session selected"}
              </span>
            </div>
            <span style={{ ...styles.subtle, color: theme.mutedText }}>
              {activeSession?.entries?.length ? `${activeSession.entries.length} entries` : "No requests yet"}
            </span>
          </div>

          <div style={styles.workspaceMain}>
            <div ref={feedRef} style={styles.feed}>
              {activeSession?.entries?.map((entry) => (
                <article
                  key={entry.id}
                  style={{
                    ...styles.feedItem,
                    alignSelf: entry.role === "operator" ? "flex-end" : "stretch",
                    backgroundColor: entry.role === "operator" ? "#166534" : isDark ? "#0f172a" : "#f8fafc",
                    color: entry.role === "operator" ? "#fff" : theme.text,
                    borderColor: entry.role === "operator" ? "#166534" : theme.cardBorder,
                  }}
                >
                  <div style={styles.feedMeta}>
                    <span>{entry.role === "operator" ? "Operator" : "AI Console"}</span>
                    <span>{formatEntryTime(entry.createdAt)}</span>
                  </div>
                  <div style={styles.feedText}>{entry.text}</div>

                  {entry.summary ? <div style={styles.summaryBlock}>Plan: {entry.summary}</div> : null}
                  {entry.requiresClarification && entry.clarificationQuestion ? (
                    <div style={styles.warningBlock}>Clarification needed: {entry.clarificationQuestion}</div>
                  ) : null}
                  {entry.actions?.length ? (
                    <div style={styles.detailBlock}>
                      <strong>Planned actions</strong>
                      {entry.actions.map((action, index) => (
                        <div key={`${entry.id}-action-${index}`} style={styles.detailRow}>
                          {action.action_type} ({action.risk_level})
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {entry.results?.length ? (
                    <div style={styles.detailBlock}>
                      <strong>Results</strong>
                      {entry.results.map((result, index) => (
                        <div key={`${entry.id}-result-${index}`} style={styles.detailRow}>
                          {result.status === "completed" ? "Completed" : "Failed"}: {result.message}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {entry.buttons?.length ? (
                    <div style={styles.actionLinkList}>
                      {entry.buttons.map((item) => (
                        <div key={`${entry.id}-${item.path}-${item.label}`} style={styles.actionLinkCard}>
                          <strong>{item.label}</strong>
                          <span>{item.note}</span>
                          <button type="button" style={styles.actionLinkButton} onClick={() => (window.location.href = item.path)}>
                            Open
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}

              {!activeSession?.entries?.length ? (
                <div style={{ ...styles.emptyState, color: theme.mutedText }}>
                  Open a session or start a new one. Only the opened session's history is sent to the assistant.
                </div>
              ) : null}
            </div>

            <aside style={styles.commandRail}>
              <div style={{ ...styles.composerCard, backgroundColor: isDark ? "#0f172a" : "#f8fafc", borderColor: theme.cardBorder }}>
                <h2 style={styles.sectionTitle}>Issue a command</h2>
                <p style={{ ...styles.subtle, color: theme.mutedText }}>
                  The AI only sees the currently opened session, so follow-ups stay connected without mixing threads.
                </p>
                <form onSubmit={handleSubmit} style={styles.stack}>
                  <textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    rows={6}
                    placeholder="Example: Create an institution called Rift Valley Command for user jane_admin and add mark_otieno as member."
                    style={{
                      ...styles.textarea,
                      backgroundColor: isDark ? "#020617" : "#fff",
                      borderColor: theme.cardBorder,
                      color: theme.text,
                    }}
                  />
                  <button type="submit" disabled={submitting || !activeSession} style={{ ...styles.primaryButton, opacity: submitting ? 0.7 : 1 }}>
                    {submitting ? "Running..." : "Run with AI"}
                  </button>
                </form>
              </div>

              <div style={styles.examples}>
                <div style={styles.inlineSectionHeader}>
                  <h3 style={styles.examplesTitle}>Quick prompts</h3>
                  <span style={{ ...styles.quickHint, color: theme.mutedText }}>Click to load</span>
                </div>
                <div style={styles.exampleList}>
                  {starterPrompts.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPrompt(item)}
                      style={{ ...styles.exampleChip, borderColor: theme.cardBorder, color: theme.text }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ ...styles.supportCard, backgroundColor: isDark ? "#0f172a" : "#f8fafc", borderColor: theme.cardBorder }}>
                <h3 style={styles.examplesTitle}>Supported actions</h3>
                <div style={{ ...styles.subtle, color: theme.mutedText }}>
                  List users, list institutions, create institutions, create facilities, add institution members, update user staff or active status, and unblock IPs.
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: 14, minHeight: "100%" },
  hero: { border: "1px solid #d0e6d2", borderRadius: 20, padding: 18, display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" },
  heroCopy: { maxWidth: 720 },
  kicker: { margin: 0, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 },
  title: { margin: "6px 0", fontSize: 28, lineHeight: 1.08 },
  subtle: { fontSize: 13, lineHeight: 1.45 },
  identityCard: { minWidth: 200, border: "1px solid #d0e6d2", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 6, height: "fit-content" },
  identityLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.75, fontWeight: 700 },
  identityTag: { width: "fit-content", color: "#fff", backgroundColor: "#166534", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 700 },
  errorBanner: { padding: "12px 14px", borderRadius: 12, backgroundColor: "#fee2e2", color: "#991b1b", fontWeight: 600 },
  layout: { display: "grid", gridTemplateColumns: "280px minmax(0, 1fr)", gap: 14, alignItems: "start" },
  sessionCard: { border: "1px solid #d0e6d2", borderRadius: 18, padding: 14, display: "flex", flexDirection: "column", gap: 14, minHeight: 720, maxHeight: "calc(100vh - 220px)" },
  workspaceCard: { border: "1px solid #d0e6d2", borderRadius: 18, padding: 14, display: "flex", flexDirection: "column", gap: 12, minHeight: 720, maxHeight: "calc(100vh - 220px)" },
  workspaceMain: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 14, minHeight: 0, flex: 1 },
  commandRail: { display: "flex", flexDirection: "column", gap: 12, minHeight: 0, overflowY: "auto", paddingRight: 2 },
  composerCard: { border: "1px solid #d0e6d2", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 12 },
  sessionHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  sessionList: { display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", minHeight: 0, paddingRight: 2 },
  sessionItem: { border: "1px solid #d0e6d2", borderRadius: 14, padding: 12, textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 6 },
  sessionItemTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 },
  sessionTitle: { fontSize: 13, lineHeight: 1.35 },
  sessionMeta: { fontSize: 12 },
  sessionPreview: { fontSize: 12, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" },
  sessionBadge: { backgroundColor: "#166534", color: "#fff", borderRadius: 999, padding: "4px 8px", fontSize: 11, fontWeight: 700 },
  secondaryButton: { border: "1px solid #166534", borderRadius: 10, padding: "9px 11px", backgroundColor: "transparent", color: "#166534", fontWeight: 700, cursor: "pointer" },
  feedHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" },
  sectionTitle: { margin: 0, fontSize: 18 },
  stack: { display: "flex", flexDirection: "column", gap: 10 },
  textarea: { border: "1px solid #d0e6d2", borderRadius: 12, padding: 12, fontSize: 14, resize: "vertical", fontFamily: "inherit" },
  primaryButton: { border: "none", borderRadius: 12, padding: "12px 14px", backgroundColor: "#166534", color: "#fff", fontWeight: 700, cursor: "pointer" },
  examples: { display: "flex", flexDirection: "column", gap: 8 },
  examplesTitle: { margin: 0, fontSize: 15 },
  inlineSectionHeader: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" },
  quickHint: { fontSize: 12 },
  exampleList: { display: "flex", flexDirection: "column", gap: 8 },
  exampleChip: { border: "1px solid #d0e6d2", borderRadius: 12, padding: "10px 12px", backgroundColor: "transparent", textAlign: "left", cursor: "pointer", fontSize: 12, lineHeight: 1.35 },
  supportCard: { border: "1px solid #d0e6d2", borderRadius: 14, padding: 12, display: "flex", flexDirection: "column", gap: 6 },
  feed: { display: "flex", flexDirection: "column", gap: 12, minHeight: 0, overflowY: "auto", paddingRight: 2 },
  feedItem: { border: "1px solid #d0e6d2", borderRadius: 16, padding: 12, display: "flex", flexDirection: "column", gap: 8, maxWidth: "100%" },
  feedMeta: { display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" },
  feedText: { fontSize: 14, lineHeight: 1.5 },
  summaryBlock: { fontSize: 12, lineHeight: 1.45, padding: "9px 11px", borderRadius: 10, backgroundColor: "rgba(15, 23, 42, 0.08)" },
  warningBlock: { fontSize: 12, lineHeight: 1.45, padding: "9px 11px", borderRadius: 10, backgroundColor: "#fef3c7", color: "#92400e" },
  detailBlock: { display: "flex", flexDirection: "column", gap: 5, fontSize: 12 },
  detailRow: { lineHeight: 1.5, opacity: 0.92 },
  actionLinkList: { display: "flex", flexDirection: "column", gap: 8 },
  actionLinkCard: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "10px 11px",
    borderRadius: 10,
    backgroundColor: "rgba(15, 118, 110, 0.08)",
  },
  actionLinkButton: {
    width: "fit-content",
    border: "1px solid #166534",
    borderRadius: 999,
    padding: "6px 10px",
    backgroundColor: "transparent",
    color: "#166534",
    fontWeight: 700,
    cursor: "pointer",
  },
  emptyState: { minHeight: 220, display: "grid", placeItems: "center", textAlign: "center", border: "1px dashed #bbf7d0", borderRadius: 16, padding: 18 },
  lockedCard: { border: "1px solid #d0e6d2", borderRadius: 20, padding: 24 },
};

export default ChatPage;
