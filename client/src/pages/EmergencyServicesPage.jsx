import React, { useEffect, useMemo, useState } from "react";

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

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "dispatched", label: "Dispatched" },
  { value: "resolved", label: "Resolved" },
];

const defaultForm = {
  institution_id: "",
  facility_id: "",
  incident_type: "robbery",
  summary: "",
  location_label: "",
  latitude: "",
  longitude: "",
};

const parseError = (data, fallback) => {
  if (typeof data?.error === "string") return data.error;
  const firstKey = data ? Object.keys(data)[0] : null;
  const firstValue = firstKey ? data[firstKey] : null;
  if (Array.isArray(firstValue) && firstValue[0]) return `${firstKey}: ${firstValue[0]}`;
  if (typeof firstValue === "string") return `${firstKey}: ${firstValue}`;
  return fallback;
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const toMapEmbedUrl = (latitude, longitude) =>
  `https://www.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;

const toMapsUrl = (latitude, longitude) => `https://www.google.com/maps?q=${latitude},${longitude}`;

function EmergencyServicesPage() {
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
  const [alerts, setAlerts] = useState([]);
  const [activeAlertId, setActiveAlertId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState(defaultForm);
  const [operatorForm, setOperatorForm] = useState({ status: "new", operator_notes: "" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState({ type: "", text: "" });

  const filteredFacilities = useMemo(() => {
    if (!form.institution_id) return facilities;
    return facilities.filter((facility) => String(facility.institution_id) === String(form.institution_id));
  }, [facilities, form.institution_id]);

  const filteredAlerts = useMemo(() => {
    if (!statusFilter) return alerts;
    return alerts.filter((alert) => alert.status === statusFilter);
  }, [alerts, statusFilter]);

  const activeAlert = useMemo(
    () => filteredAlerts.find((item) => item.id === activeAlertId) || filteredAlerts[0] || null,
    [activeAlertId, filteredAlerts]
  );

  const stats = useMemo(() => {
    const total = alerts.length;
    const open = alerts.filter((item) => item.status === "new").length;
    const dispatched = alerts.filter((item) => item.status === "dispatched").length;
    const resolved = alerts.filter((item) => item.status === "resolved").length;
    return [
      { label: "Total alerts", value: total, note: "Visible to your account" },
      { label: "New", value: open, note: "Awaiting operator action" },
      { label: "Dispatched", value: dispatched, note: "Operators already engaged" },
      { label: "Resolved", value: resolved, note: "Closed emergencies" },
    ];
  }, [alerts]);

  const replaceAlert = (nextAlert) => {
    setAlerts((prev) => {
      const exists = prev.some((item) => item.id === nextAlert.id);
      if (!exists) return [nextAlert, ...prev];
      return prev.map((item) => (item.id === nextAlert.id ? nextAlert : item));
    });
    setActiveAlertId(nextAlert.id);
    setOperatorForm({
      status: nextAlert.status,
      operator_notes: nextAlert.operator_notes || "",
    });
  };

  const loadPage = async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      const alertsUrl = statusFilter
        ? `${CHAT_API}/emergency-alerts/?status=${encodeURIComponent(statusFilter)}`
        : `${CHAT_API}/emergency-alerts/`;

      const [profileRes, institutionsRes, facilitiesRes, alertsRes] = await Promise.all([
        apiFetch(`${ACCOUNTS_API}/profile/`, { headers }),
        apiFetch(`${ACCOUNTS_API}/institutions/`, { headers }),
        apiFetch(`${SECURITY_API}/facilities/`, { headers }),
        apiFetch(alertsUrl, { headers }),
      ]);

      const [profileData, institutionsData, facilitiesData, alertsData] = await Promise.all([
        profileRes.json(),
        institutionsRes.json(),
        facilitiesRes.json(),
        alertsRes.json(),
      ]);

      if (!profileRes.ok) throw new Error(parseError(profileData, "Failed to load profile"));
      if (!institutionsRes.ok) throw new Error(parseError(institutionsData, "Failed to load institutions"));
      if (!facilitiesRes.ok) throw new Error(parseError(facilitiesData, "Failed to load facilities"));
      if (!alertsRes.ok) throw new Error(parseError(alertsData, "Failed to load emergency alerts"));

      const institutionList = institutionsData.institutions || [];
      const facilityList = Array.isArray(facilitiesData)
        ? facilitiesData
        : Array.isArray(facilitiesData.facilities)
          ? facilitiesData.facilities
          : [];
      const alertList = Array.isArray(alertsData) ? alertsData : [];

      setProfile(profileData.user || null);
      setInstitutions(institutionList);
      setFacilities(facilityList);
      setAlerts(alertList);
      setForm((prev) => ({
        ...prev,
        institution_id: prev.institution_id || institutionList[0]?.id || "",
      }));
      setActiveAlertId((prev) => alertList.find((item) => item.id === prev)?.id || alertList[0]?.id || "");
    } catch (error) {
      setBanner({ type: "error", text: error.message || "Failed to load emergency services module" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, statusFilter]);

  useEffect(() => {
    if (!activeAlert) return;
    setOperatorForm({
      status: activeAlert.status,
      operator_notes: activeAlert.operator_notes || "",
    });
  }, [activeAlert]);

  const handleCreateAlert = async (event) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      const res = await apiFetch(`${CHAT_API}/emergency-alerts/`, {
        method: "POST",
        headers,
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(parseError(data, "Failed to create emergency alert"));
      replaceAlert(data);
      setForm((prev) => ({
        ...defaultForm,
        institution_id: prev.institution_id,
      }));
      setBanner({ type: "success", text: "Emergency alert shared with operators." });
    } catch (error) {
      setBanner({ type: "error", text: error.message || "Failed to create emergency alert" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAlert = async (nextStatus) => {
    if (!activeAlert) return;
    try {
      setSaving(true);
      const payload = {
        status: nextStatus || operatorForm.status,
        operator_notes: operatorForm.operator_notes,
      };
      const res = await apiFetch(`${CHAT_API}/emergency-alerts/${activeAlert.id}/`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(parseError(data, "Failed to update emergency alert"));
      replaceAlert(data);
      setBanner({ type: "success", text: "Operator update saved." });
    } catch (error) {
      setBanner({ type: "error", text: error.message || "Failed to update emergency alert" });
    } finally {
      setSaving(false);
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
            ? "linear-gradient(135deg, #1f2937 0%, #172554 50%, #0f766e 100%)"
            : "linear-gradient(135deg, #fff7ed 0%, #eff6ff 45%, #ecfdf5 100%)",
          borderColor: theme.cardBorder,
        }}
      >
        <div style={styles.heroCopy}>
          <p style={{ ...styles.eyebrow, color: isDark ? "#fdba74" : "#9a3412" }}>Emergency Services</p>
          <h1 style={styles.heroTitle}>Institution-to-operator dispatch desk</h1>
          <p style={{ ...styles.heroText, color: theme.mutedText }}>
            Share a live incident location with just the essentials, then let operators acknowledge, dispatch, and resolve from the same queue.
          </p>
          {profile ? (
            <p style={{ ...styles.heroMeta, color: theme.mutedText }}>
              Signed in as {profile.first_name || profile.username} {profile.is_staff ? "| staff operator access" : "| institution access"}
            </p>
          ) : null}
        </div>
        <div style={styles.heroActions}>
          <button type="button" style={styles.primaryHeroButton} onClick={() => loadPage({ silent: true })}>
            {refreshing ? "Refreshing..." : "Refresh queue"}
          </button>
          <button type="button" style={styles.secondaryHeroButton} onClick={() => (window.location.href = "/incidents/manage")}>
            Open incident manager
          </button>
        </div>
      </section>

      {banner.text ? <div style={{ ...styles.banner, ...bannerStyle }}>{banner.text}</div> : null}

      <section style={styles.statsGrid}>
        {stats.map((item) => (
          <article key={item.label} style={{ ...styles.statCard, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
            <div style={styles.statValue}>{item.value}</div>
            <div style={styles.statLabel}>{item.label}</div>
            <div style={{ ...styles.statNote, color: theme.mutedText }}>{item.note}</div>
          </article>
        ))}
      </section>

      <div style={styles.layout}>
        <section style={{ ...styles.sidebarCard, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Operator Queue</h2>
              <p style={{ ...styles.sectionHint, color: theme.mutedText }}>Incoming alerts ordered by latest activity.</p>
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            style={{ ...styles.input, backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: theme.cardBorder, color: theme.text }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {loading ? (
            <div style={{ ...styles.emptyState, color: theme.mutedText }}>Loading alerts...</div>
          ) : filteredAlerts.length ? (
            <div style={styles.alertList}>
              {filteredAlerts.map((alert) => {
                const isActive = alert.id === activeAlert?.id;
                return (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => setActiveAlertId(alert.id)}
                    style={{
                      ...styles.alertCard,
                      backgroundColor: isActive ? (isDark ? "#0f172a" : "#eff6ff") : "transparent",
                      borderColor: isActive ? "#0f766e" : theme.cardBorder,
                      color: theme.text,
                    }}
                  >
                    <div style={styles.alertCardTop}>
                      <strong>{alert.institution_name}</strong>
                      <span style={styles.statusBadge}>{alert.status}</span>
                    </div>
                    <div style={{ ...styles.alertCardType, color: "#0f766e" }}>{alert.incident_type.replaceAll("_", " ")}</div>
                    <div style={{ ...styles.alertCardSummary, color: theme.mutedText }}>{alert.summary}</div>
                    <div style={{ ...styles.alertCardMeta, color: theme.mutedText }}>
                      {alert.location_label || "No landmark"} | {formatDateTime(alert.created_at)}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ ...styles.emptyState, color: theme.mutedText }}>No emergency alerts match the current filter.</div>
          )}
        </section>

        <section style={{ ...styles.detailCard, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Alert Detail</h2>
              <p style={{ ...styles.sectionHint, color: theme.mutedText }}>
                {activeAlert ? "Review the incident context, location, and operator notes." : "Select an alert from the queue."}
              </p>
            </div>
          </div>

          {activeAlert ? (
            <>
              <div style={styles.detailMetaRow}>
                <div style={styles.metaPill}>Institution: {activeAlert.institution_name}</div>
                <div style={styles.metaPill}>Facility: {activeAlert.facility_name || "Not set"}</div>
                <div style={styles.metaPill}>Status: {activeAlert.status}</div>
              </div>
              <div style={styles.detailBlock}>
                <h3 style={styles.blockTitle}>Minimal Incident Detail</h3>
                <p style={styles.blockBody}>{activeAlert.summary}</p>
                <p style={{ ...styles.blockMeta, color: theme.mutedText }}>
                  {activeAlert.location_label || "No landmark provided"} | {activeAlert.latitude}, {activeAlert.longitude}
                </p>
              </div>
              <iframe
                title={`map-${activeAlert.id}`}
                src={toMapEmbedUrl(activeAlert.latitude, activeAlert.longitude)}
                style={styles.mapFrame}
                loading="lazy"
              />
              <div style={styles.linkRow}>
                <a href={toMapsUrl(activeAlert.latitude, activeAlert.longitude)} target="_blank" rel="noreferrer" style={styles.mapLink}>
                  Open coordinates in Google Maps
                </a>
                {activeAlert.incident_id ? (
                  <a href={`/incidents/manage?incident=${activeAlert.incident_id}`} style={styles.mapLink}>
                    Open linked incident
                  </a>
                ) : null}
              </div>
              <div style={styles.operatorPanel}>
                <div style={styles.operatorHeader}>
                  <h3 style={styles.blockTitle}>Operator Update</h3>
                  <span style={{ ...styles.blockMeta, color: theme.mutedText }}>
                    Assigned to {activeAlert.assigned_operator_name || "unclaimed"} | updated {formatDateTime(activeAlert.updated_at)}
                  </span>
                </div>
                <select
                  value={operatorForm.status}
                  onChange={(event) => setOperatorForm((prev) => ({ ...prev, status: event.target.value }))}
                  style={{ ...styles.input, backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: theme.cardBorder, color: theme.text }}
                >
                  {STATUS_OPTIONS.filter((option) => option.value).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <textarea
                  rows={6}
                  value={operatorForm.operator_notes}
                  onChange={(event) => setOperatorForm((prev) => ({ ...prev, operator_notes: event.target.value }))}
                  placeholder="Capture dispatch notes, assigned units, or closure details."
                  style={{ ...styles.textarea, backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: theme.cardBorder, color: theme.text }}
                />
                <div style={styles.actionRow}>
                  <button type="button" style={styles.primaryButton} disabled={saving} onClick={() => handleUpdateAlert()}>
                    {saving ? "Saving..." : "Save operator update"}
                  </button>
                  <button type="button" style={styles.secondaryButton} disabled={saving} onClick={() => handleUpdateAlert("acknowledged")}>
                    Acknowledge
                  </button>
                  <button type="button" style={styles.secondaryButton} disabled={saving} onClick={() => handleUpdateAlert("dispatched")}>
                    Mark dispatched
                  </button>
                  <button type="button" style={styles.secondaryButton} disabled={saving} onClick={() => handleUpdateAlert("resolved")}>
                    Resolve
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ ...styles.emptyState, color: theme.mutedText }}>No alert selected.</div>
          )}
        </section>

        <section style={{ ...styles.formCard, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Share New Emergency</h2>
              <p style={{ ...styles.sectionHint, color: theme.mutedText }}>Send the minimum dispatch packet an operator needs: type, summary, landmark, and map coordinates.</p>
            </div>
          </div>
          <form onSubmit={handleCreateAlert} style={styles.form}>
            <select
              value={form.institution_id}
              onChange={(event) => setForm((prev) => ({ ...prev, institution_id: event.target.value, facility_id: "" }))}
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
              value={form.facility_id}
              onChange={(event) => setForm((prev) => ({ ...prev, facility_id: event.target.value }))}
              style={{ ...styles.input, backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: theme.cardBorder, color: theme.text }}
            >
              <option value="">Optional facility</option>
              {filteredFacilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </select>
            <select
              value={form.incident_type}
              onChange={(event) => setForm((prev) => ({ ...prev, incident_type: event.target.value }))}
              style={{ ...styles.input, backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: theme.cardBorder, color: theme.text }}
              required
            >
              {INCIDENT_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <textarea
              rows={5}
              value={form.summary}
              onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
              placeholder="Short incident description for the operator queue"
              style={{ ...styles.textarea, backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: theme.cardBorder, color: theme.text }}
              required
            />
            <input
              value={form.location_label}
              onChange={(event) => setForm((prev) => ({ ...prev, location_label: event.target.value }))}
              placeholder="Landmark or area description"
              style={{ ...styles.input, backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: theme.cardBorder, color: theme.text }}
            />
            <div style={styles.dualFieldRow}>
              <input
                value={form.latitude}
                onChange={(event) => setForm((prev) => ({ ...prev, latitude: event.target.value }))}
                placeholder="Latitude"
                style={{ ...styles.input, backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: theme.cardBorder, color: theme.text }}
                required
              />
              <input
                value={form.longitude}
                onChange={(event) => setForm((prev) => ({ ...prev, longitude: event.target.value }))}
                placeholder="Longitude"
                style={{ ...styles.input, backgroundColor: isDark ? "#0f172a" : "#fff", borderColor: theme.cardBorder, color: theme.text }}
                required
              />
            </div>
            <button type="submit" style={styles.primaryButton} disabled={submitting}>
              {submitting ? "Sharing..." : "Share with operators"}
            </button>
          </form>
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
  layout: { display: "grid", gridTemplateColumns: "320px minmax(0, 1fr) 360px", gap: 18, alignItems: "start" },
  sidebarCard: { border: "1px solid #d0e6d2", borderRadius: 20, padding: 18, minHeight: 780, display: "flex", flexDirection: "column", gap: 14 },
  detailCard: { border: "1px solid #d0e6d2", borderRadius: 20, padding: 18, minHeight: 780, display: "flex", flexDirection: "column", gap: 16 },
  formCard: { border: "1px solid #d0e6d2", borderRadius: 20, padding: 18, minHeight: 780, display: "flex", flexDirection: "column", gap: 16 },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  sectionTitle: { margin: 0, fontSize: 20 },
  sectionHint: { margin: "4px 0 0", fontSize: 13, lineHeight: 1.5 },
  alertList: { display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" },
  alertCard: { border: "1px solid #d0e6d2", borderRadius: 16, padding: 14, textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 8 },
  alertCardTop: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" },
  alertCardType: { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" },
  alertCardSummary: { fontSize: 13, lineHeight: 1.5 },
  alertCardMeta: { fontSize: 12, lineHeight: 1.5 },
  statusBadge: { backgroundColor: "#dbeafe", color: "#1d4ed8", borderRadius: 999, padding: "4px 8px", fontSize: 11, fontWeight: 700, textTransform: "capitalize" },
  detailMetaRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  metaPill: { backgroundColor: "#ecfeff", color: "#155e75", border: "1px solid #a5f3fc", borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 700 },
  detailBlock: { border: "1px solid #d0e6d2", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 8 },
  operatorPanel: { border: "1px solid #d0e6d2", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 10 },
  operatorHeader: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" },
  blockTitle: { margin: 0, fontSize: 15, color: "#0f766e" },
  blockBody: { margin: 0, fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" },
  blockMeta: { margin: 0, fontSize: 12, lineHeight: 1.5 },
  mapFrame: { width: "100%", minHeight: 280, border: "1px solid #d0e6d2", borderRadius: 18 },
  linkRow: { display: "flex", gap: 12, flexWrap: "wrap" },
  mapLink: { color: "#0f766e", fontWeight: 700, textDecoration: "none" },
  form: { display: "flex", flexDirection: "column", gap: 10 },
  input: { border: "1px solid #d0e6d2", borderRadius: 12, padding: "11px 12px", fontSize: 14, width: "100%", boxSizing: "border-box" },
  textarea: { border: "1px solid #d0e6d2", borderRadius: 12, padding: "11px 12px", fontSize: 14, width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" },
  dualFieldRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  primaryButton: { border: "none", borderRadius: 12, padding: "12px 14px", backgroundColor: "#0f766e", color: "#fff", fontWeight: 700, cursor: "pointer" },
  secondaryButton: { border: "1px solid #0f766e", borderRadius: 12, padding: "12px 14px", backgroundColor: "transparent", color: "#0f766e", fontWeight: 700, cursor: "pointer" },
  actionRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  emptyState: { minHeight: 160, display: "grid", placeItems: "center", textAlign: "center", border: "1px dashed #bbf7d0", borderRadius: 18, padding: 20 },
};

export default EmergencyServicesPage;
