import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { apiFetch } from "../utils/apiFetch";
import {
  ACCOUNTS_API_BASE as ACCOUNTS_API,
  CHAT_API_BASE as CHAT_API,
  SECURITY_API_BASE as SECURITY_API,
} from "../utils/apiBase";
import { useColorMode } from "../utils/useColorMode";

const INCIDENT_TYPES = [
  { value: "robbery", label: "Robbery" },
  { value: "assault", label: "Assault" },
  { value: "accident", label: "Accident" },
  { value: "missing_person", label: "Missing Person" },
  { value: "murder", label: "Murder" },
  { value: "theft", label: "Theft" },
  { value: "other", label: "Other" },
];

const QUICK_NOTE_TEMPLATES = [
  "Caller confirmed exact location and nearby landmark.",
  "Dispatch requested from nearest facility.",
  "Victim is safe and awaiting officer arrival.",
  "Suspect fled scene before response team arrived.",
];

const getDefaultOccurredAt = () => {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
};

const parseError = (data, fallback) => {
  if (typeof data?.error === "string") return data.error;
  const firstKey = data ? Object.keys(data)[0] : null;
  const firstValue = firstKey ? data[firstKey] : null;
  if (Array.isArray(firstValue) && firstValue[0]) return `${firstKey}: ${firstValue[0]}`;
  if (typeof firstValue === "string") return `${firstKey}: ${firstValue}`;
  return fallback;
};

const formatMessageTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const defaultConversationForm = {
  institution_id: "",
  facility_id: "",
  subject: "",
  customer_name: "",
  customer_contact: "",
  initial_message: "",
};

const defaultIncidentForm = {
  incident_type: "robbery",
  ob_number: "",
  description: "",
  latitude: "",
  longitude: "",
  occurred_at: getDefaultOccurredAt(),
  facility_id: "",
};

const openInNewPage = (path) => {
  window.open(path, "_blank", "noopener,noreferrer");
};

function CallCenterWorkboardPage() {
  const token = localStorage.getItem("access_token");
  const { theme, isDark } = useColorMode();

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const [profile, setProfile] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [banner, setBanner] = useState({ type: "", text: "" });
  const [conversationForm, setConversationForm] = useState(defaultConversationForm);
  const [noteBody, setNoteBody] = useState("");
  const [incidentForm, setIncidentForm] = useState(defaultIncidentForm);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [sendingNote, setSendingNote] = useState(false);
  const [creatingIncident, setCreatingIncident] = useState(false);
  const [askingAssistant, setAskingAssistant] = useState(false);
  const messageFeedRef = useRef(null);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) || conversations[0] || null,
    [conversations, activeConversationId]
  );

  const activeInstitutionFacilities = useMemo(() => {
    const institutionId = conversationForm.institution_id || activeConversation?.institution_id || "";
    if (!institutionId) return facilities;
    return facilities.filter((facility) => String(facility.institution_id) === String(institutionId));
  }, [conversationForm.institution_id, activeConversation, facilities]);

  const queueStats = useMemo(() => {
    const total = conversations.length;
    const open = conversations.filter((item) => item.status === "open").length;
    const pending = conversations.filter((item) => item.status === "pending").length;
    const linked = conversations.filter((item) => item.incident_id).length;
    return [
      { label: "Live calls", value: total, note: "All visible conversations" },
      { label: "Open", value: open, note: "Needs active handling" },
      { label: "Pending", value: pending, note: "Escalated or waiting" },
      { label: "Incident linked", value: linked, note: "Calls already converted" },
    ];
  }, [conversations]);

  const quickLinks = useMemo(
    () => [
      { label: "Open Incident Manager", path: "/incidents/manage", note: "Continue follow-up workflows" },
      { label: "New Incident View", path: "/incidents", note: "Open the broader incident screen" },
      { label: "Facility Map", path: "/facilities/map", note: "Check closest stations and geography" },
      { label: "Institutions", path: "/institutions", note: "Review institution ownership and members" },
      { label: "AI Insights", path: "/ai/insights", note: "Review AI summaries and signal trends" },
    ],
    []
  );

  const syncIncidentFormFromConversation = (conversation) => {
    if (!conversation) return;
    const lastRelevantMessage =
      [...(conversation.messages || [])].reverse().find((message) => message.sender_type === "agent" || message.sender_type === "customer")
        ?.body || "";
    setIncidentForm((prev) => ({
      ...prev,
      description: prev.description || lastRelevantMessage || conversation.subject || "",
      facility_id: prev.facility_id || conversation.facility_id || "",
    }));
  };

  const loadBoard = async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      const [profileRes, institutionsRes, facilitiesRes, conversationsRes] = await Promise.all([
        apiFetch(`${ACCOUNTS_API}/profile/`, { method: "GET", headers }),
        apiFetch(`${ACCOUNTS_API}/institutions/`, { method: "GET", headers }),
        apiFetch(`${SECURITY_API}/facilities/`, { method: "GET", headers }),
        apiFetch(`${CHAT_API}/conversations/`, { method: "GET", headers }),
      ]);

      const [profileData, institutionsData, facilitiesData, conversationsData] = await Promise.all([
        profileRes.json(),
        institutionsRes.json(),
        facilitiesRes.json(),
        conversationsRes.json(),
      ]);

      if (!profileRes.ok) throw new Error(parseError(profileData, "Failed to load profile"));
      if (!institutionsRes.ok) throw new Error(parseError(institutionsData, "Failed to load institutions"));
      if (!facilitiesRes.ok) throw new Error(parseError(facilitiesData, "Failed to load facilities"));
      if (!conversationsRes.ok) throw new Error(parseError(conversationsData, "Failed to load call queue"));

      const institutionList = institutionsData.institutions || [];
      const facilityList = Array.isArray(facilitiesData)
        ? facilitiesData
        : Array.isArray(facilitiesData.facilities)
          ? facilitiesData.facilities
          : [];
      const conversationList = Array.isArray(conversationsData) ? conversationsData : [];

      setProfile(profileData.user || null);
      setInstitutions(institutionList);
      setFacilities(facilityList);
      setConversations(conversationList);
      setActiveConversationId((prev) => conversationList.find((item) => item.id === prev)?.id || conversationList[0]?.id || "");
      setConversationForm((prev) => ({
        ...prev,
        institution_id: prev.institution_id || institutionList[0]?.id || "",
      }));
    } catch (error) {
      setBanner({ type: "error", text: error.message || "Failed to load call center work board" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    loadBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (activeConversation) syncIncidentFormFromConversation(activeConversation);
  }, [activeConversation]);

  useLayoutEffect(() => {
    const feedNode = messageFeedRef.current;
    if (!feedNode) {
      return;
    }
    const scrollToLatest = () => {
      feedNode.scrollTop = feedNode.scrollHeight;
    };
    scrollToLatest();
    const frameId = window.requestAnimationFrame(scrollToLatest);
    return () => window.cancelAnimationFrame(frameId);
  }, [activeConversationId, activeConversation?.messages?.length]);

  const handleCreateConversation = async (event) => {
    event.preventDefault();
    try {
      setCreatingConversation(true);
      const res = await apiFetch(`${CHAT_API}/conversations/`, {
        method: "POST",
        headers,
        body: JSON.stringify(conversationForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(parseError(data, "Failed to create call conversation"));
      const nextConversation = data.conversation;
      setConversations((prev) => [nextConversation, ...prev]);
      setActiveConversationId(nextConversation.id);
      setConversationForm((prev) => ({
        ...defaultConversationForm,
        institution_id: prev.institution_id || nextConversation.institution_id || "",
      }));
      setNoteBody("");
      setBanner({ type: "success", text: "Call conversation created and added to the queue." });
    } catch (error) {
      setBanner({ type: "error", text: error.message || "Failed to create conversation" });
    } finally {
      setCreatingConversation(false);
    }
  };

  const handleSendNote = async () => {
    const body = noteBody.trim();
    if (!body || !activeConversation) return;
    try {
      setSendingNote(true);
      const res = await apiFetch(`${CHAT_API}/conversations/${activeConversation.id}/messages/`, {
        method: "POST",
        headers,
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(parseError(data, "Failed to add note to conversation"));
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === activeConversation.id
            ? { ...conversation, messages: [...(conversation.messages || []), data] }
            : conversation
        )
      );
      setNoteBody("");
      setBanner({ type: "success", text: "Conversation note saved." });
    } catch (error) {
      setBanner({ type: "error", text: error.message || "Failed to add note" });
    } finally {
      setSendingNote(false);
    }
  };

  const handleCreateIncident = async (event) => {
    event.preventDefault();
    if (!activeConversation) {
      setBanner({ type: "error", text: "Select a conversation first." });
      return;
    }
    try {
      setCreatingIncident(true);
      const payload = {
        ...incidentForm,
        facility_id: incidentForm.facility_id || activeConversation.facility_id || "",
      };
      const res = await apiFetch(`${CHAT_API}/conversations/${activeConversation.id}/create-incident/`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(parseError(data, "Failed to create incident from call"));
      const updatedConversation = data.conversation;
      setConversations((prev) =>
        prev.map((conversation) => (conversation.id === updatedConversation.id ? updatedConversation : conversation))
      );
      setIncidentForm((prev) => ({
        ...defaultIncidentForm,
        description: "",
        facility_id: updatedConversation.facility_id || prev.facility_id || "",
      }));
      setBanner({ type: "success", text: "Incident created from the selected conversation." });
    } catch (error) {
      setBanner({ type: "error", text: error.message || "Failed to create incident" });
    } finally {
      setCreatingIncident(false);
    }
  };

  const handleAskAssistant = async () => {
    const message = noteBody.trim();
    if (!message || !activeConversation) return;
    try {
      setAskingAssistant(true);
      const res = await apiFetch(`${CHAT_API}/conversations/${activeConversation.id}/assistant/`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(parseError(data, "Failed to get assistant reply"));
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === activeConversation.id
            ? {
                ...conversation,
                messages: [...(conversation.messages || []), ...(data.agent_message ? [data.agent_message] : []), data.message],
              }
            : conversation
        )
      );
      setNoteBody("");
    } catch (error) {
      setBanner({ type: "error", text: error.message || "Failed to get assistant reply" });
    } finally {
      setAskingAssistant(false);
    }
  };

  const bannerStyle =
    banner.type === "error"
      ? styles.errorBanner
      : banner.type === "success"
        ? styles.successBanner
        : styles.infoBanner;

  return (
    <div style={{ ...styles.page, color: theme.text }}>
      <section
        style={{
          ...styles.hero,
          background: isDark
            ? "linear-gradient(135deg, #111827 0%, #102a43 100%)"
            : "linear-gradient(135deg, #eff6ff 0%, #ecfeff 50%, #f0fdf4 100%)",
          borderColor: theme.cardBorder,
        }}
      >
        <div style={styles.heroCopy}>
          <p style={{ ...styles.eyebrow, color: isDark ? "#93c5fd" : "#0f766e" }}>Call Center</p>
          <h1 style={styles.heroTitle}>Operations work board</h1>
          <p style={{ ...styles.heroText, color: theme.mutedText }}>
            Capture phone conversations, log live notes, and convert important calls into incidents without leaving the queue.
          </p>
          {profile ? (
            <p style={{ ...styles.heroMeta, color: theme.mutedText }}>
              Signed in as {profile.first_name || profile.username} {profile.is_staff ? "| Staff view" : "| Member view"}
            </p>
          ) : null}
        </div>
        <div style={styles.heroActions}>
          <button type="button" style={styles.primaryHeroButton} onClick={() => loadBoard({ silent: true })}>
            {refreshing ? "Refreshing..." : "Refresh queue"}
          </button>
          <button type="button" style={styles.secondaryHeroButton} onClick={() => (window.location.href = "/incidents/manage")}>
            Open incident manager
          </button>
        </div>
      </section>

      {banner.text ? <div style={{ ...styles.banner, ...bannerStyle }}>{banner.text}</div> : null}

      <section style={styles.statsGrid}>
        {queueStats.map((stat) => (
          <article key={stat.label} style={{ ...styles.statCard, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
            <div style={styles.statValue}>{stat.value}</div>
            <div style={styles.statLabel}>{stat.label}</div>
            <div style={{ ...styles.statNote, color: theme.mutedText }}>{stat.note}</div>
          </article>
        ))}
      </section>

      <div style={styles.boardLayout}>
        <section style={{ ...styles.queueCard, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Call Queue</h2>
              <p style={{ ...styles.sectionHint, color: theme.mutedText }}>Active and recent conversations across your visible workspaces.</p>
            </div>
          </div>
          {loading ? (
            <div style={{ ...styles.emptyState, color: theme.mutedText }}>Loading conversations...</div>
          ) : conversations.length ? (
            <div style={styles.queueList}>
              {conversations.map((conversation) => {
                const isActive = conversation.id === activeConversation?.id;
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setActiveConversationId(conversation.id)}
                    style={{
                      ...styles.queueItem,
                      backgroundColor: isActive ? (isDark ? "#0f172a" : "#eff6ff") : "transparent",
                      borderColor: isActive ? "#0f766e" : theme.cardBorder,
                      color: theme.text,
                    }}
                  >
                    <div style={styles.queueTopLine}>
                      <strong>{conversation.customer_name || "Unknown caller"}</strong>
                      <span style={styles.statusBadge}>{conversation.status}</span>
                    </div>
                    <div style={{ ...styles.queueMeta, color: theme.mutedText }}>{conversation.subject || "Untitled call"}</div>
                    <div style={{ ...styles.queueMeta, color: theme.mutedText }}>
                      {conversation.customer_contact || "No contact"} {conversation.incident_id ? "| Incident linked" : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ ...styles.emptyState, color: theme.mutedText }}>No call conversations yet. Start one from the actions panel.</div>
          )}
        </section>

        <section style={{ ...styles.threadCard, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Conversation Desk</h2>
              <p style={{ ...styles.sectionHint, color: theme.mutedText }}>
                {activeConversation ? `${activeConversation.customer_name || "Unknown caller"} | ${activeConversation.subject || "Untitled call"}` : "Select a call from the queue"}
              </p>
            </div>
          </div>

          {activeConversation ? (
            <>
              <div style={styles.conversationSummary}>
                <div style={styles.summaryPill}>Caller: {activeConversation.customer_name || "Unknown"}</div>
                <div style={styles.summaryPill}>Contact: {activeConversation.customer_contact || "Unavailable"}</div>
                <div style={styles.summaryPill}>Status: {activeConversation.status}</div>
              </div>
              <div ref={messageFeedRef} style={styles.messageFeed}>
                {(activeConversation.messages || []).length ? (
                  activeConversation.messages.map((message) => (
                    <article
                      key={message.id}
                      style={{
                        ...styles.messageBubble,
                        alignSelf: message.sender_type === "agent" ? "flex-end" : "flex-start",
                        backgroundColor: message.sender_type === "agent" ? "#0f766e" : isDark ? "#0f172a" : "#f8fafc",
                        borderColor: message.sender_type === "agent" ? "#0f766e" : theme.cardBorder,
                        color: message.sender_type === "agent" ? "#fff" : theme.text,
                      }}
                    >
                      <div style={styles.messageMeta}>
                        <span>{message.sender_user_name || message.sender_type}</span>
                        <span>{formatMessageTime(message.created_at)}</span>
                      </div>
                      <div style={styles.messageBody}>{message.body}</div>
                      {Array.isArray(message.metadata?.assistant_buttons) && message.metadata.assistant_buttons.length ? (
                        <div style={styles.suggestionListInline}>
                          {message.metadata.assistant_buttons.map((item) => (
                            <div key={`${message.id}-${item.label}-${item.path}`} style={styles.suggestionCardInline}>
                              <strong>{item.label}</strong>
                              <span>{item.note}</span>
                              <button type="button" style={styles.suggestionButton} onClick={() => openInNewPage(item.path)}>
                                Open
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <div style={{ ...styles.emptyState, color: theme.mutedText }}>No transcript entries yet.</div>
                )}
              </div>
              <div style={styles.quickNoteBar}>
                {QUICK_NOTE_TEMPLATES.map((template) => (
                  <button
                    key={template}
                    type="button"
                    style={styles.templateButton}
                    onClick={() => setNoteBody((prev) => (prev ? `${prev}\n${template}` : template))}
                  >
                    {template}
                  </button>
                ))}
              </div>
              <div style={styles.noteComposer}>
                <textarea
                  rows={5}
                  value={noteBody}
                  onChange={(event) => setNoteBody(event.target.value)}
                  placeholder="Log what the caller says, dispatch decisions, or type a question for AI help."
                  style={{ ...styles.textarea, backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: theme.cardBorder, color: theme.text }}
                />
                <div style={styles.composerActions}>
                  <button type="button" style={styles.primaryButton} disabled={sendingNote || askingAssistant} onClick={handleSendNote}>
                    {sendingNote ? "Saving note..." : "Save note"}
                  </button>
                  <button type="button" style={styles.secondaryActionButton} disabled={askingAssistant || sendingNote} onClick={handleAskAssistant}>
                    {askingAssistant ? "Saving and asking AI..." : "Save note and ask AI"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ ...styles.emptyState, color: theme.mutedText }}>Choose a call from the queue to review the transcript and log updates.</div>
          )}
        </section>

        <section style={{ ...styles.toolsCard, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Actions</h2>
              <p style={{ ...styles.sectionHint, color: theme.mutedText }}>Create calls, add notes, and escalate while the suggestions live inside the chat stream.</p>
            </div>
          </div>
          <form onSubmit={handleCreateConversation} style={styles.formBlock}>
            <h3 style={styles.formTitle}>Start New Call</h3>
            <select
              value={conversationForm.institution_id}
              onChange={(event) => setConversationForm((prev) => ({ ...prev, institution_id: event.target.value, facility_id: "" }))}
              style={{ ...styles.input, backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: theme.cardBorder, color: theme.text }}
              required
            >
              <option value="">Select institution</option>
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
                </option>
              ))}
            </select>
            <select
              value={conversationForm.facility_id}
              onChange={(event) => setConversationForm((prev) => ({ ...prev, facility_id: event.target.value }))}
              style={{ ...styles.input, backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: theme.cardBorder, color: theme.text }}
            >
              <option value="">Optional facility</option>
              {activeInstitutionFacilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </select>
            <input
              value={conversationForm.customer_name}
              onChange={(event) => setConversationForm((prev) => ({ ...prev, customer_name: event.target.value }))}
              placeholder="Caller name"
              style={{ ...styles.input, backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: theme.cardBorder, color: theme.text }}
            />
            <input
              value={conversationForm.customer_contact}
              onChange={(event) => setConversationForm((prev) => ({ ...prev, customer_contact: event.target.value }))}
              placeholder="Caller phone"
              style={{ ...styles.input, backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: theme.cardBorder, color: theme.text }}
            />
            <input
              value={conversationForm.subject}
              onChange={(event) => setConversationForm((prev) => ({ ...prev, subject: event.target.value }))}
              placeholder="Call subject"
              style={{ ...styles.input, backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: theme.cardBorder, color: theme.text }}
              required
            />
            <textarea
              rows={4}
              value={conversationForm.initial_message}
              onChange={(event) => setConversationForm((prev) => ({ ...prev, initial_message: event.target.value }))}
              placeholder="First summary of the caller report"
              style={{ ...styles.textarea, backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: theme.cardBorder, color: theme.text }}
            />
            <button type="submit" style={styles.primaryButton} disabled={creatingConversation}>
              {creatingConversation ? "Creating call..." : "Create call record"}
            </button>
          </form>
          <form onSubmit={handleCreateIncident} style={styles.formBlock}>
            <h3 style={styles.formTitle}>Create Incident From Active Call</h3>
            <select
              value={incidentForm.incident_type}
              onChange={(event) => setIncidentForm((prev) => ({ ...prev, incident_type: event.target.value }))}
              style={{ ...styles.input, backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: theme.cardBorder, color: theme.text }}
              required
            >
              {INCIDENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <input
              value={incidentForm.ob_number}
              onChange={(event) => setIncidentForm((prev) => ({ ...prev, ob_number: event.target.value }))}
              placeholder="OB number"
              style={{ ...styles.input, backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: theme.cardBorder, color: theme.text }}
              required
            />
            <textarea
              rows={4}
              value={incidentForm.description}
              onChange={(event) => setIncidentForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Incident description"
              style={{ ...styles.textarea, backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: theme.cardBorder, color: theme.text }}
              required
            />
            <div style={styles.dualFieldRow}>
              <input
                value={incidentForm.latitude}
                onChange={(event) => setIncidentForm((prev) => ({ ...prev, latitude: event.target.value }))}
                placeholder="Latitude"
                style={{ ...styles.input, backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: theme.cardBorder, color: theme.text }}
                required
              />
              <input
                value={incidentForm.longitude}
                onChange={(event) => setIncidentForm((prev) => ({ ...prev, longitude: event.target.value }))}
                placeholder="Longitude"
                style={{ ...styles.input, backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: theme.cardBorder, color: theme.text }}
                required
              />
            </div>
            <input
              type="datetime-local"
              value={incidentForm.occurred_at}
              onChange={(event) => setIncidentForm((prev) => ({ ...prev, occurred_at: event.target.value }))}
              style={{ ...styles.input, backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: theme.cardBorder, color: theme.text }}
              required
            />
            <button type="submit" style={styles.primaryButton} disabled={creatingIncident || !activeConversation}>
              {creatingIncident ? "Creating incident..." : "Escalate to incident"}
            </button>
          </form>
          <div style={styles.formBlock}>
            <h3 style={styles.formTitle}>Quick Actions</h3>
            <div style={styles.quickActionList}>
              {quickLinks.map((link) => (
                <button key={link.path} type="button" style={styles.quickLinkButton} onClick={() => openInNewPage(link.path)}>
                  <strong>{link.label}</strong>
                  <span>{link.note}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: 18, minHeight: "100%" },
  hero: { border: "1px solid #d0e6d2", borderRadius: 24, padding: 24, display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" },
  heroCopy: { maxWidth: 760 },
  eyebrow: { margin: 0, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 },
  heroTitle: { margin: "8px 0", fontSize: 34, lineHeight: 1.08 },
  heroText: { margin: 0, fontSize: 14, lineHeight: 1.6 },
  heroMeta: { margin: "10px 0 0", fontSize: 12, lineHeight: 1.5, fontWeight: 600 },
  heroActions: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" },
  primaryHeroButton: { border: "none", borderRadius: 14, padding: "13px 16px", backgroundColor: "#0f766e", color: "#fff", fontWeight: 700, cursor: "pointer" },
  secondaryHeroButton: { border: "1px solid #0f766e", borderRadius: 14, padding: "12px 16px", backgroundColor: "transparent", color: "#0f766e", fontWeight: 700, cursor: "pointer" },
  banner: { padding: "12px 14px", borderRadius: 12, fontWeight: 600 },
  successBanner: { backgroundColor: "#dcfce7", color: "#166534" },
  errorBanner: { backgroundColor: "#fee2e2", color: "#991b1b" },
  infoBanner: { backgroundColor: "#e0f2fe", color: "#075985" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 },
  statCard: { border: "1px solid #d0e6d2", borderRadius: 18, padding: 16 },
  statValue: { fontSize: 28, fontWeight: 800, color: "#0f172a" },
  statLabel: { marginTop: 8, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0f766e" },
  statNote: { marginTop: 6, fontSize: 12, lineHeight: 1.5 },
  boardLayout: { display: "grid", gridTemplateColumns: "320px minmax(0, 1fr) 380px", gap: 18, alignItems: "start" },
  queueCard: { border: "1px solid #d0e6d2", borderRadius: 20, padding: 18, minHeight: 760, display: "flex", flexDirection: "column", gap: 14 },
  threadCard: { border: "1px solid #d0e6d2", borderRadius: 20, padding: 18, minHeight: 760, display: "flex", flexDirection: "column", gap: 14 },
  toolsCard: { border: "1px solid #d0e6d2", borderRadius: 20, padding: 18, minHeight: 760, display: "flex", flexDirection: "column", gap: 16 },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  sectionTitle: { margin: 0, fontSize: 20 },
  sectionHint: { margin: "4px 0 0", fontSize: 13, lineHeight: 1.5 },
  queueList: { display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" },
  queueItem: { border: "1px solid #d0e6d2", borderRadius: 16, padding: 14, textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 8 },
  queueTopLine: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" },
  queueMeta: { fontSize: 12, lineHeight: 1.5 },
  statusBadge: { backgroundColor: "#dbeafe", color: "#1d4ed8", borderRadius: 999, padding: "4px 8px", fontSize: 11, fontWeight: 700, textTransform: "capitalize" },
  conversationSummary: { display: "flex", gap: 8, flexWrap: "wrap" },
  summaryPill: { backgroundColor: "#ecfeff", color: "#155e75", border: "1px solid #a5f3fc", borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 700 },
  messageFeed: { display: "flex", flexDirection: "column", gap: 12, minHeight: 300, maxHeight: 420, overflowY: "auto", paddingRight: 4 },
  messageBubble: { border: "1px solid #d0e6d2", borderRadius: 18, padding: 14, display: "flex", flexDirection: "column", gap: 8, maxWidth: "88%" },
  messageMeta: { display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, fontWeight: 700, opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.06em" },
  messageBody: { fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" },
  quickNoteBar: { display: "flex", flexWrap: "wrap", gap: 8 },
  templateButton: { border: "1px solid #cbd5e1", borderRadius: 999, padding: "8px 10px", backgroundColor: "transparent", color: "#334155", fontSize: 12, cursor: "pointer" },
  noteComposer: { display: "flex", flexDirection: "column", gap: 12, marginTop: "auto" },
  composerActions: { display: "flex", gap: 10, flexWrap: "wrap" },
  suggestionListInline: { display: "flex", flexDirection: "column", gap: 10, marginTop: 4 },
  suggestionCardInline: { border: "1px solid #cbd5e1", borderRadius: 12, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8, backgroundColor: "rgba(255,255,255,0.4)" },
  formBlock: { border: "1px solid #d0e6d2", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 10 },
  formTitle: { margin: 0, fontSize: 15, color: "#0f766e" },
  input: { border: "1px solid #d0e6d2", borderRadius: 12, padding: "11px 12px", fontSize: 14, width: "100%", boxSizing: "border-box" },
  textarea: { border: "1px solid #d0e6d2", borderRadius: 12, padding: "11px 12px", fontSize: 14, width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" },
  dualFieldRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  primaryButton: { border: "none", borderRadius: 12, padding: "12px 14px", backgroundColor: "#0f766e", color: "#fff", fontWeight: 700, cursor: "pointer" },
  secondaryActionButton: { border: "1px solid #0f766e", borderRadius: 12, padding: "12px 14px", backgroundColor: "transparent", color: "#0f766e", fontWeight: 700, cursor: "pointer" },
  quickActionList: { display: "flex", flexDirection: "column", gap: 10 },
  suggestionButton: { alignSelf: "flex-start", border: "none", borderRadius: 10, padding: "10px 12px", backgroundColor: "#0f766e", color: "#fff", fontWeight: 700, cursor: "pointer" },
  quickLinkButton: { border: "1px solid #cbd5e1", borderRadius: 14, padding: "12px 14px", backgroundColor: "transparent", textAlign: "left", display: "flex", flexDirection: "column", gap: 4, cursor: "pointer", color: "#0f172a" },
  emptyState: { minHeight: 160, display: "grid", placeItems: "center", textAlign: "center", border: "1px dashed #bbf7d0", borderRadius: 18, padding: 20 },
};

export default CallCenterWorkboardPage;
