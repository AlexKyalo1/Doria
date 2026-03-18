import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useColorMode } from "../utils/useColorMode";
import {
  buildAuthHeaders,
  createCheckoutSession,
  fetchBillingSnapshot,
  fetchInstitutions,
  fetchPlans,
} from "../utils/billingApi";

const BillingPage = () => {
  const token = localStorage.getItem("access_token");
  const headers = useMemo(() => buildAuthHeaders(token), [token]);
  const { theme, isDark } = useColorMode();

  const [institutions, setInstitutions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [checkoutPlanCode, setCheckoutPlanCode] = useState("");
  const [alert, setAlert] = useState({ type: "", message: "" });

  const showAlert = useCallback((message, type = "info") => {
    setAlert({ message, type });
  }, []);

  const clearAlert = useCallback(() => {
    setAlert({ type: "", message: "" });
  }, []);

  const loadBaseData = useCallback(async () => {
    setLoading(true);
    try {
      const [institutionList, planList] = await Promise.all([
        fetchInstitutions(headers),
        fetchPlans(headers),
      ]);
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

  const loadSnapshot = useCallback(async () => {
    if (!selectedInstitutionId) {
      setSnapshot(null);
      return;
    }
    setSnapshotLoading(true);
    try {
      const data = await fetchBillingSnapshot(selectedInstitutionId, headers);
      setSnapshot(data);
    } catch (error) {
      setSnapshot(null);
      showAlert(error.message, "error");
    } finally {
      setSnapshotLoading(false);
    }
  }, [headers, selectedInstitutionId, showAlert]);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billingStatus = params.get("billing");
    if (billingStatus === "success") {
      showAlert("Stripe checkout completed. Webhook confirmation may take a moment.", "success");
    } else if (billingStatus === "cancel") {
      showAlert("Checkout was canceled.", "warning");
    }
  }, [showAlert]);

  const handleCheckout = async (planCode) => {
    if (!selectedInstitutionId) {
      showAlert("Choose an institution first.", "warning");
      return;
    }
    setCheckoutPlanCode(planCode);
    try {
      const payload = {
        plan_code: planCode,
        success_url: `${window.location.origin}/billing?billing=success`,
        cancel_url: `${window.location.origin}/billing?billing=cancel`,
      };
      const data = await createCheckoutSession(selectedInstitutionId, headers, payload);
      if (data.checkout?.url) {
        window.location.href = data.checkout.url;
        return;
      }
      showAlert("Checkout session created, but no redirect URL was returned.", "warning");
      await loadSnapshot();
    } catch (error) {
      showAlert(error.message, "error");
    } finally {
      setCheckoutPlanCode("");
    }
  };

  const currentPlanCode = snapshot?.subscription?.plan?.code || "free";

  return (
    <div style={{ ...styles.page, backgroundColor: theme.pageBg }}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={{ ...styles.title, color: theme.text }}>Billing</h1>
          <p style={{ ...styles.subtitle, color: theme.mutedText }}>
            Manage institution plans, inspect entitlements, and launch Stripe checkout.
          </p>
        </div>
        <button type="button" style={styles.secondaryButton} onClick={loadBaseData}>
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
          <span style={{ ...styles.metaText, color: theme.mutedText }}>{institutions.length} available</span>
        </div>
        {loading ? (
          <p style={{ ...styles.emptyText, color: theme.mutedText }}>Loading institutions...</p>
        ) : institutions.length === 0 ? (
          <p style={{ ...styles.emptyText, color: theme.mutedText }}>Create an institution to unlock billing.</p>
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
                <span style={styles.institutionName}>{institution.name}</span>
                <span style={styles.institutionMeta}>{institution.id}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div style={styles.grid}>
        <section style={{ ...styles.panel, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.panelHeader}>
            <h2 style={{ ...styles.sectionTitle, color: theme.text }}>Subscription Snapshot</h2>
            <span style={{ ...styles.metaText, color: theme.mutedText }}>
              {snapshotLoading ? "Refreshing..." : snapshot?.subscription?.status || "No subscription"}
            </span>
          </div>
          {!selectedInstitutionId ? (
            <p style={{ ...styles.emptyText, color: theme.mutedText }}>Select an institution.</p>
          ) : snapshotLoading ? (
            <p style={{ ...styles.emptyText, color: theme.mutedText }}>Loading billing data...</p>
          ) : (
            <div style={styles.snapshotWrap}>
              <div style={styles.kpiGrid}>
                <article style={{ ...styles.kpiCard, backgroundColor: isDark ? "#0f172a" : "#f7fcf8" }}>
                  <span style={styles.kpiLabel}>Current Plan</span>
                  <strong style={{ color: theme.text }}>{snapshot?.subscription?.plan?.name || "Free"}</strong>
                </article>
                <article style={{ ...styles.kpiCard, backgroundColor: isDark ? "#0f172a" : "#f7fcf8" }}>
                  <span style={styles.kpiLabel}>Provider</span>
                  <strong style={{ color: theme.text }}>{snapshot?.subscription?.provider || "manual"}</strong>
                </article>
                <article style={{ ...styles.kpiCard, backgroundColor: isDark ? "#0f172a" : "#f7fcf8" }}>
                  <span style={styles.kpiLabel}>Period End</span>
                  <strong style={{ color: theme.text }}>{formatDate(snapshot?.subscription?.current_period_end)}</strong>
                </article>
              </div>

              <div style={styles.entitlementGrid}>
                {(snapshot?.entitlements || []).map((item) => (
                  <article key={item.code} style={{ ...styles.entitlementCard, borderColor: theme.cardBorder }}>
                    <div style={styles.entitlementTop}>
                      <span style={{ ...styles.entitlementCode, color: theme.text }}>{item.code}</span>
                      <span style={styles.sourceBadge(item.source)}>{item.source}</span>
                    </div>
                    <div style={{ ...styles.entitlementValue, color: theme.mutedText }}>
                      {item.value_type === "boolean"
                        ? item.is_enabled
                          ? "Enabled"
                          : "Disabled"
                        : item.limit_value ?? "Unlimited"}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>

        <section style={{ ...styles.panel, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.panelHeader}>
            <h2 style={{ ...styles.sectionTitle, color: theme.text }}>Plans</h2>
            <span style={{ ...styles.metaText, color: theme.mutedText }}>Stripe-ready</span>
          </div>
          <div style={styles.planGrid}>
            {plans.map((plan) => {
              const isCurrent = plan.code === currentPlanCode;
              return (
                <article key={plan.code} style={{ ...styles.planCard, borderColor: isCurrent ? "#0f766e" : theme.cardBorder }}>
                  <div style={styles.planHeader}>
                    <div>
                      <h3 style={{ ...styles.planTitle, color: theme.text }}>{plan.name}</h3>
                      <p style={{ ...styles.planDescription, color: theme.mutedText }}>{plan.description}</p>
                    </div>
                    {isCurrent && <span style={styles.currentBadge}>Current</span>}
                  </div>
                  <div style={{ ...styles.planPrice, color: theme.text }}>
                    {formatMoney(plan.price_amount, plan.currency)}
                    <span style={styles.priceSuffix}>/{plan.billing_interval}</span>
                  </div>
                  <ul style={styles.featureList}>
                    {(plan.entitlements || []).slice(0, 4).map((entitlement) => (
                      <li key={entitlement.feature.code} style={{ color: theme.mutedText }}>
                        {entitlement.feature.code}: {entitlement.limit_value ?? (entitlement.is_enabled ? "enabled" : "disabled")}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    disabled={checkoutPlanCode === plan.code || !selectedInstitutionId}
                    onClick={() => handleCheckout(plan.code)}
                    style={{
                      ...styles.primaryButton,
                      opacity: checkoutPlanCode === plan.code ? 0.7 : 1,
                    }}
                  >
                    {checkoutPlanCode === plan.code ? "Starting..." : "Choose Plan"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <section style={{ ...styles.panel, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
        <div style={styles.panelHeader}>
          <h2 style={{ ...styles.sectionTitle, color: theme.text }}>Admin Overrides In Effect</h2>
        </div>
        {!snapshot?.overrides?.length ? (
          <p style={{ ...styles.emptyText, color: theme.mutedText }}>No manual overrides are active for this institution.</p>
        ) : (
          <div style={styles.overrideList}>
            {snapshot.overrides.map((override) => (
              <div key={override.feature_code} style={{ ...styles.overrideItem, borderColor: theme.cardBorder }}>
                <div>
                  <strong style={{ color: theme.text }}>{override.feature_code}</strong>
                  <p style={{ ...styles.overrideReason, color: theme.mutedText }}>{override.reason || "No reason provided"}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: theme.text }}>
                    {override.limit_value ?? (override.is_enabled ? "Enabled" : "Disabled")}
                  </div>
                  <small style={{ color: theme.mutedText }}>{override.updated_by_username || "Admin"}</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
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
  return date.toLocaleDateString();
}

function formatMoney(amount, currency) {
  const numericAmount = Number(amount || 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency || "USD").toUpperCase(),
      maximumFractionDigits: 2,
    }).format(numericAmount);
  } catch {
    return `${numericAmount} ${(currency || "usd").toUpperCase()}`;
  }
}

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
    maxWidth: "700px",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 1fr) minmax(320px, 1.2fr)",
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
  metaText: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
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
  },
  institutionButtonActive: {
    background: "linear-gradient(135deg, #0f766e 0%, #115e59 100%)",
    color: "#f0fdfa",
    border: "1px solid #14b8a6",
    boxShadow: "0 10px 20px rgba(15, 118, 110, 0.18)",
  },
  institutionButtonIdle: (isDark) => ({
    backgroundColor: isDark ? "#0f172a" : "#f8faf8",
    color: isDark ? "#e5e7eb" : "#1f2937",
    border: `1px solid ${isDark ? "#374151" : "#d7e7d9"}`,
  }),
  institutionName: {
    display: "block",
    fontWeight: 700,
    marginBottom: "6px",
  },
  institutionMeta: {
    fontSize: "12px",
    opacity: 0.8,
  },
  snapshotWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "12px",
  },
  kpiCard: {
    padding: "14px",
    borderRadius: "14px",
  },
  kpiLabel: {
    display: "block",
    marginBottom: "8px",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#6b7280",
  },
  entitlementGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
  },
  entitlementCard: {
    border: "1px solid #d0e6d2",
    borderRadius: "14px",
    padding: "14px",
  },
  entitlementTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "12px",
  },
  entitlementCode: {
    fontWeight: 700,
    fontSize: "13px",
  },
  sourceBadge: (source) => ({
    backgroundColor: source === "override" ? "#fef3c7" : source === "plan" ? "#dbeafe" : "#e5e7eb",
    color: source === "override" ? "#92400e" : source === "plan" ? "#1d4ed8" : "#374151",
    borderRadius: "999px",
    padding: "4px 8px",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontWeight: 700,
  }),
  entitlementValue: {
    fontSize: "14px",
    fontWeight: 600,
  },
  planGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: "14px",
  },
  planCard: {
    border: "1px solid #d0e6d2",
    borderRadius: "16px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  planHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "10px",
  },
  planTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 700,
  },
  planDescription: {
    margin: "6px 0 0",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  currentBadge: {
    backgroundColor: "#ccfbf1",
    color: "#115e59",
    padding: "4px 8px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  planPrice: {
    fontSize: "30px",
    fontWeight: 800,
  },
  priceSuffix: {
    fontSize: "14px",
    color: "#6b7280",
    marginLeft: "6px",
  },
  featureList: {
    margin: 0,
    paddingLeft: "18px",
    display: "grid",
    gap: "6px",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  primaryButton: {
    border: "none",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #0f766e 0%, #115e59 100%)",
    color: "white",
    padding: "12px 14px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #0f766e",
    borderRadius: "12px",
    backgroundColor: "transparent",
    color: "#0f766e",
    padding: "10px 14px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  overrideList: {
    display: "grid",
    gap: "10px",
  },
  overrideItem: {
    border: "1px solid #d0e6d2",
    borderRadius: "14px",
    padding: "14px",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
  },
  overrideReason: {
    margin: "6px 0 0",
    fontSize: "13px",
  },
  emptyText: {
    margin: 0,
    fontSize: "14px",
  },
};

export default BillingPage;
