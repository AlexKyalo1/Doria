import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useColorMode } from "../utils/useColorMode";
import {
  buildAuthHeaders,
  fetchBillingSnapshot,
  fetchInstitutionEvents,
  fetchAdminInstitutions,
  fetchPlans,
  fetchProfile,
  updateInstitutionOverrides,
  updateInstitutionSubscription,
} from "../utils/billingApi";

const BillingAdminPage = () => {
  const token = localStorage.getItem("access_token");
  const headers = useMemo(() => buildAuthHeaders(token), [token]);
  const { theme, isDark } = useColorMode();

  const [profile, setProfile] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingSubscription, setSavingSubscription] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [subscriptionForm, setSubscriptionForm] = useState({
    plan_code: "",
    status: "active",
    provider: "manual",
    cancel_at_period_end: false,
  });
  const [overrideForm, setOverrideForm] = useState({
    feature_code: "",
    is_enabled: "",
    limit_value: "",
    reason: "",
  });

  const showAlert = useCallback((message, type = "info") => {
    setAlert({ message, type });
  }, []);

  const clearAlert = useCallback(() => setAlert({ type: "", message: "" }), []);

  const loadReferenceData = useCallback(async () => {
    setLoading(true);
    try {
      const user = await fetchProfile(headers);
      const [institutionList, planList] = await Promise.all([
        user?.is_staff ? fetchAdminInstitutions(headers) : Promise.resolve([]),
        fetchPlans(headers),
      ]);
      setProfile(user);
      setInstitutions(institutionList);
      setPlans(planList);
      if (institutionList.length > 0) {
        setSelectedInstitutionId((current) => current || institutionList[0].id);
      }
    } catch (error) {
      showAlert(error.message, "error");
    } finally {
      setLoading(false);
    }
  }, [headers, showAlert]);

  const loadInstitutionData = useCallback(async () => {
    if (!selectedInstitutionId || !profile?.is_staff) {
      setSnapshot(null);
      setEvents([]);
      return;
    }
    try {
      const [billingData, paymentEvents] = await Promise.all([
        fetchBillingSnapshot(selectedInstitutionId, headers),
        fetchInstitutionEvents(selectedInstitutionId, headers),
      ]);
      setSnapshot(billingData);
      setEvents(paymentEvents);
      setSubscriptionForm({
        plan_code: billingData.subscription?.plan?.code || "",
        status: billingData.subscription?.status || "active",
        provider: billingData.subscription?.provider || "manual",
        cancel_at_period_end: Boolean(billingData.subscription?.cancel_at_period_end),
      });
      setOverrideForm((current) => ({
        ...current,
        feature_code: current.feature_code || billingData.entitlements?.[0]?.code || "",
      }));
    } catch (error) {
      showAlert(error.message, "error");
    }
  }, [headers, profile?.is_staff, selectedInstitutionId, showAlert]);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    loadInstitutionData();
  }, [loadInstitutionData]);

  const handleSubscriptionSubmit = async (event) => {
    event.preventDefault();
    if (!selectedInstitutionId) {
      return;
    }
    setSavingSubscription(true);
    try {
      await updateInstitutionSubscription(selectedInstitutionId, headers, subscriptionForm);
      showAlert("Subscription updated.", "success");
      await loadInstitutionData();
    } catch (error) {
      showAlert(error.message, "error");
    } finally {
      setSavingSubscription(false);
    }
  };

  const handleOverrideSubmit = async (event) => {
    event.preventDefault();
    if (!selectedInstitutionId) {
      return;
    }

    const payload = {
      feature_code: overrideForm.feature_code,
      reason: overrideForm.reason,
    };
    if (overrideForm.is_enabled !== "") {
      payload.is_enabled = overrideForm.is_enabled === "true";
    }
    if (overrideForm.limit_value !== "") {
      payload.limit_value = Number(overrideForm.limit_value);
    }

    setSavingOverride(true);
    try {
      await updateInstitutionOverrides(selectedInstitutionId, headers, payload);
      showAlert("Override saved.", "success");
      setOverrideForm((current) => ({ ...current, reason: "", limit_value: "" }));
      await loadInstitutionData();
    } catch (error) {
      showAlert(error.message, "error");
    } finally {
      setSavingOverride(false);
    }
  };

  if (!loading && profile && !profile.is_staff) {
    return (
      <div style={{ ...styles.page, backgroundColor: theme.pageBg }}>
        <section style={{ ...styles.panel, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <h1 style={{ ...styles.title, color: theme.text }}>Billing Admin</h1>
          <p style={{ ...styles.subtitle, color: theme.mutedText }}>
            Admin access is required to manage institution subscription overrides.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div style={{ ...styles.page, backgroundColor: theme.pageBg }}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={{ ...styles.title, color: theme.text }}>Billing Admin</h1>
          <p style={{ ...styles.subtitle, color: theme.mutedText }}>
            Apply manual plan changes, feature gates, and limit overrides per institution.
          </p>
        </div>
        <button type="button" style={styles.secondaryButton} onClick={loadReferenceData}>
          Refresh
        </button>
      </div>

      {alert.message && (
        <div style={{ ...styles.alert, ...alertStyles[alert.type || "info"] }}>
          <span>{alert.message}</span>
          <button type="button" style={styles.alertClose} onClick={clearAlert}>
            x
          </button>
        </div>
      )}

      <section style={{ ...styles.panel, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
        <div style={styles.panelHeader}>
          <h2 style={{ ...styles.sectionTitle, color: theme.text }}>Institution</h2>
        </div>
        {loading ? (
          <p style={{ color: theme.mutedText }}>Loading institutions...</p>
        ) : (
          <div style={styles.institutionList}>
            {institutions.map((institution) => (
              <button
                key={institution.id}
                type="button"
                onClick={() => setSelectedInstitutionId(institution.id)}
                style={{
                  ...styles.institutionButton,
                  ...(selectedInstitutionId === institution.id
                    ? styles.institutionButtonActive
                    : styles.institutionButtonIdle(isDark)),
                }}
              >
                <strong>{institution.name}</strong>
                <span style={styles.institutionMeta}>{institution.id}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div style={styles.grid}>
        <section style={{ ...styles.panel, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.panelHeader}>
            <h2 style={{ ...styles.sectionTitle, color: theme.text }}>Subscription Override</h2>
          </div>
          <form onSubmit={handleSubscriptionSubmit} style={styles.form}>
            <label style={styles.label}>
              Plan
              <select
                value={subscriptionForm.plan_code}
                onChange={(event) => setSubscriptionForm((current) => ({ ...current, plan_code: event.target.value }))}
                style={styles.input}
              >
                {plans.map((plan) => (
                  <option key={plan.code} value={plan.code}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={styles.label}>
              Status
              <select
                value={subscriptionForm.status}
                onChange={(event) => setSubscriptionForm((current) => ({ ...current, status: event.target.value }))}
                style={styles.input}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label style={styles.label}>
              Provider
              <select
                value={subscriptionForm.provider}
                onChange={(event) => setSubscriptionForm((current) => ({ ...current, provider: event.target.value }))}
                style={styles.input}
              >
                {PROVIDER_OPTIONS.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </label>
            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={subscriptionForm.cancel_at_period_end}
                onChange={(event) =>
                  setSubscriptionForm((current) => ({
                    ...current,
                    cancel_at_period_end: event.target.checked,
                  }))
                }
              />
              Cancel at period end
            </label>
            <button type="submit" style={styles.primaryButton} disabled={savingSubscription}>
              {savingSubscription ? "Saving..." : "Save Subscription"}
            </button>
          </form>
        </section>

        <section style={{ ...styles.panel, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.panelHeader}>
            <h2 style={{ ...styles.sectionTitle, color: theme.text }}>Feature Override</h2>
          </div>
          <form onSubmit={handleOverrideSubmit} style={styles.form}>
            <label style={styles.label}>
              Feature
              <select
                value={overrideForm.feature_code}
                onChange={(event) => setOverrideForm((current) => ({ ...current, feature_code: event.target.value }))}
                style={styles.input}
              >
                {(snapshot?.entitlements || []).map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code}
                  </option>
                ))}
              </select>
            </label>
            <label style={styles.label}>
              Enable / Disable
              <select
                value={overrideForm.is_enabled}
                onChange={(event) => setOverrideForm((current) => ({ ...current, is_enabled: event.target.value }))}
                style={styles.input}
              >
                <option value="">No change</option>
                <option value="true">Enable</option>
                <option value="false">Disable</option>
              </select>
            </label>
            <label style={styles.label}>
              Limit Value
              <input
                type="number"
                min="0"
                value={overrideForm.limit_value}
                onChange={(event) => setOverrideForm((current) => ({ ...current, limit_value: event.target.value }))}
                style={styles.input}
                placeholder="Leave blank for no numeric override"
              />
            </label>
            <label style={styles.label}>
              Reason
              <textarea
                rows="3"
                value={overrideForm.reason}
                onChange={(event) => setOverrideForm((current) => ({ ...current, reason: event.target.value }))}
                style={styles.textarea}
                placeholder="Optional admin note"
              />
            </label>
            <button type="submit" style={styles.primaryButton} disabled={savingOverride}>
              {savingOverride ? "Saving..." : "Save Override"}
            </button>
          </form>
        </section>
      </div>

      <div style={styles.grid}>
        <section style={{ ...styles.panel, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.panelHeader}>
            <h2 style={{ ...styles.sectionTitle, color: theme.text }}>Effective Entitlements</h2>
          </div>
          <div style={styles.entitlementList}>
            {(snapshot?.entitlements || []).map((item) => (
              <div key={item.code} style={{ ...styles.entitlementItem, borderColor: theme.cardBorder }}>
                <div>
                  <strong style={{ color: theme.text }}>{item.code}</strong>
                  <p style={{ ...styles.smallText, color: theme.mutedText }}>Source: {item.source}</p>
                </div>
                <strong style={{ color: theme.text }}>
                  {item.limit_value ?? (item.is_enabled ? "Enabled" : "Disabled")}
                </strong>
              </div>
            ))}
          </div>
        </section>

        <section style={{ ...styles.panel, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.panelHeader}>
            <h2 style={{ ...styles.sectionTitle, color: theme.text }}>Payment Events</h2>
          </div>
          {!events.length ? (
            <p style={{ ...styles.smallText, color: theme.mutedText }}>No payment events recorded yet.</p>
          ) : (
            <div style={styles.eventList}>
              {events.map((event) => (
                <div key={event.event_id} style={{ ...styles.eventItem, borderColor: theme.cardBorder }}>
                  <div>
                    <strong style={{ color: theme.text }}>{event.event_type}</strong>
                    <p style={{ ...styles.smallText, color: theme.mutedText }}>{event.event_id}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: theme.text }}>{event.provider}</div>
                    <p style={{ ...styles.smallText, color: theme.mutedText }}>{formatDate(event.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

function formatDate(value) {
  if (!value) {
    return "--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return date.toLocaleString();
}

const STATUS_OPTIONS = ["trialing", "active", "past_due", "canceled", "paused"];
const PROVIDER_OPTIONS = ["manual", "stripe"];

const alertStyles = {
  success: { backgroundColor: "#dcfce7", color: "#166534", border: "1px solid #86efac" },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5" },
  warning: { backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" },
  info: { backgroundColor: "#dbeafe", color: "#1d4ed8", border: "1px solid #93c5fd" },
};

const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 700,
  },
  subtitle: {
    margin: "8px 0 0",
    fontSize: "14px",
    lineHeight: 1.6,
    maxWidth: "720px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "20px",
  },
  panel: {
    border: "1px solid #d0e6d2",
    borderRadius: "18px",
    padding: "20px",
    boxShadow: "0 10px 24px rgba(15, 81, 50, 0.06)",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 700,
  },
  alert: {
    borderRadius: "14px",
    padding: "14px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  alertClose: {
    border: "none",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    fontSize: "16px",
  },
  institutionList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "10px",
  },
  institutionButton: {
    borderRadius: "14px",
    padding: "14px",
    textAlign: "left",
    cursor: "pointer",
    transition: "all 0.2s ease",
    border: "1px solid transparent",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  institutionButtonActive: {
    background: "linear-gradient(135deg, #14532d 0%, #166534 100%)",
    color: "#f0fdf4",
    border: "1px solid #4ade80",
  },
  institutionButtonIdle: (isDark) => ({
    backgroundColor: isDark ? "#0f172a" : "#f8faf8",
    color: isDark ? "#e5e7eb" : "#1f2937",
    border: `1px solid ${isDark ? "#374151" : "#d7e7d9"}`,
  }),
  institutionMeta: {
    fontSize: "12px",
    opacity: 0.75,
  },
  form: {
    display: "grid",
    gap: "14px",
  },
  label: {
    display: "grid",
    gap: "6px",
    fontSize: "13px",
    fontWeight: 600,
    color: "#374151",
  },
  input: {
    border: "1px solid #d1e0d8",
    borderRadius: "12px",
    padding: "11px 12px",
    fontSize: "14px",
    backgroundColor: "white",
  },
  textarea: {
    border: "1px solid #d1e0d8",
    borderRadius: "12px",
    padding: "11px 12px",
    fontSize: "14px",
    resize: "vertical",
    fontFamily: "inherit",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "14px",
    color: "#374151",
  },
  primaryButton: {
    border: "none",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #14532d 0%, #166534 100%)",
    color: "white",
    padding: "12px 14px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #166534",
    borderRadius: "12px",
    backgroundColor: "transparent",
    color: "#166534",
    padding: "10px 14px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  entitlementList: {
    display: "grid",
    gap: "10px",
  },
  entitlementItem: {
    border: "1px solid #d0e6d2",
    borderRadius: "14px",
    padding: "14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  smallText: {
    margin: "6px 0 0",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  eventList: {
    display: "grid",
    gap: "10px",
  },
  eventItem: {
    border: "1px solid #d0e6d2",
    borderRadius: "14px",
    padding: "14px",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
  },
};

export default BillingAdminPage;


