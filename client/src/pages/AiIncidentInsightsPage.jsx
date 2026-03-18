import React, { useEffect, useMemo, useState } from "react";

import { apiFetch } from "../utils/apiFetch";
import { useColorMode } from "../utils/useColorMode";

const ACCOUNTS_API = "http://127.0.0.1:8000/api/accounts";
const SECURITY_API = "http://127.0.0.1:8000/api/security";
const INCIDENTS_API = "http://127.0.0.1:8000/api/incidents";

const INCIDENT_TYPES = [
  { value: "", label: "All incident types" },
  { value: "robbery", label: "Robbery" },
  { value: "assault", label: "Assault" },
  { value: "accident", label: "Accident" },
  { value: "missing_person", label: "Missing Person" },
  { value: "murder", label: "Murder" },
  { value: "theft", label: "Theft" },
  { value: "other", label: "Other" },
];

const today = new Date();
const prior = new Date(today);
prior.setDate(prior.getDate() - 30);

const formatDate = (value) => value.toISOString().slice(0, 10);

const defaultFilters = {
  facility_id: "",
  incident_type: "",
  date_from: formatDate(prior),
  date_to: formatDate(today),
  max_records: 50,
};

const riskColors = {
  low: { background: "#dcfce7", color: "#166534" },
  medium: { background: "#fef3c7", color: "#92400e" },
  high: { background: "#fee2e2", color: "#b91c1c" },
};
const formatPct = (value) => {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${value}%`;
};

const formatNumber = (value) => {
  if (value === null || value === undefined) {
    return "—";
  }
  return Number(value).toLocaleString();
};

const isBillingLimitMessage = (message) => {
  const lower = (message || "").toLowerCase();
  return (
    lower.includes("ai insights are not enabled") ||
    lower.includes("monthly ai insights quota") ||
    lower.includes("quota")
  );
};

const AiIncidentInsightsPage = () => {
  const token = localStorage.getItem("access_token");
  const { theme } = useColorMode();
  const [profile, setProfile] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [result, setResult] = useState(null);
  const [drilldownItems, setDrilldownItems] = useState([]);
  const [drilldownLabel, setDrilldownLabel] = useState("");
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownError, setDrilldownError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState("");
  const [billingError, setBillingError] = useState("");

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  useEffect(() => {
    if (!token) {
      setBootLoading(false);
      return;
    }

    const load = async () => {
      try {
        const [profileRes, facilitiesRes] = await Promise.all([
          apiFetch(`${ACCOUNTS_API}/profile/`, { headers }),
          apiFetch(`${SECURITY_API}/facilities/`, { headers }),
        ]);
        const profileData = await profileRes.json();
        const facilityData = await facilitiesRes.json();

        if (profileRes.ok) {
          setProfile(profileData.user || null);
        }
        if (facilitiesRes.ok) {
          const list = Array.isArray(facilityData) ? facilityData.filter(Boolean) : Array.isArray(facilityData.facilities) ? facilityData.facilities.filter(Boolean) : [];
          setFacilities(list);
          if (list.length === 1 && !profileData.user?.is_staff) {
            setFilters((prev) => ({ ...prev, facility_id: list[0].id }));
          }
        }
      } catch {
        setError("Failed to load AI insights workspace.");
        setBillingError("");
      } finally {
        setBootLoading(false);
      }
    };

    load();
  }, [headers, token]);

  const runInsights = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setDrilldownItems([]);
    setDrilldownLabel("");
    setDrilldownError("");
    try {
      const res = await apiFetch(`${INCIDENTS_API}/ai-insights/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...filters,
          max_records: Number(filters.max_records) || 50,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate AI insights");
      }
      setResult(data);
    } catch (err) {
      const message = err.message || "Failed to generate AI insights";
      setError(message);
      setBillingError(isBillingLimitMessage(message) ? message : "");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const riskTone = riskColors[result?.insights?.risk_level] || riskColors.low;
  const analytics = result?.analytics;
  const usageSummary = result?.meta?.usage || [];
  const primaryUsage = usageSummary[0] || null;
  const quotaBlocked = primaryUsage && primaryUsage.limit !== null && primaryUsage.remaining === 0;
  const billingBlocked = Boolean(billingError) || Boolean(quotaBlocked);
  const billingPath = profile?.is_staff ? "/admin/billing" : "/billing";

  const runDrilldown = async (label, drillFilters) => {
    setDrilldownLoading(true);
    setDrilldownError("");
    setDrilldownLabel(label);
    try {
      const res = await apiFetch(`${INCIDENTS_API}/`, { headers });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load incidents for drilldown");
      }
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.incidents)
          ? data.incidents
          : Array.isArray(data.value)
            ? data.value
            : [];

      const fromDate = filters.date_from ? new Date(filters.date_from) : null;
      const toDate = filters.date_to ? new Date(filters.date_to) : null;

      const filtered = list.filter((item) => {
        if (drillFilters.facility_id) {
          const facilityId = item.facility_id ?? item.facility;
          if (String(facilityId) !== String(drillFilters.facility_id)) {
            return false;
          }
        }
        if (drillFilters.incident_type && item.incident_type !== drillFilters.incident_type) {
          return false;
        }
        if (fromDate || toDate) {
          const occurred = item.occurred_at ? new Date(item.occurred_at) : null;
          if (!occurred) {
            return false;
          }
          if (fromDate && occurred < fromDate) {
            return false;
          }
          if (toDate) {
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
            if (occurred > end) {
              return false;
            }
          }
        }
        return true;
      });

      setDrilldownItems(filtered.slice(0, 100));
    } catch (err) {
      setDrilldownError(err.message || "Failed to load drilldown incidents");
      setDrilldownItems([]);
    } finally {
      setDrilldownLoading(false);
    }
  };

  return (
    <div style={{ ...styles.page, backgroundColor: theme.pageBg }}>
      <section style={{ ...styles.hero, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
        <div>
          <div style={styles.eyebrow}>AI Incident Insights</div>
          <h1 style={{ ...styles.title, color: theme.text }}>Structured analysis for the incidents you are allowed to see</h1>
          <p style={{ ...styles.subtitle, color: theme.mutedText }}>
            Filter the dataset, send only scoped records to the backend, and get an operational summary back in JSON-backed form.
          </p>
        </div>
        {profile && (
          <div style={styles.profileChip}>
            <strong>{profile.username}</strong>
            <span>{profile.is_staff ? "Staff scope" : "User scope"}</span>
          </div>
        )}
      </section>

      <section style={{ ...styles.formCard, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
        <form onSubmit={runInsights} style={styles.formGrid}>
          <div style={styles.field}>
            <label style={styles.label}>Facility</label>
            <select
              value={filters.facility_id}
              onChange={(event) => setFilters((prev) => ({ ...prev, facility_id: event.target.value }))}
              style={styles.input}
            >
              <option value="">All visible facilities</option>
              {facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Incident Type</label>
            <select
              value={filters.incident_type}
              onChange={(event) => setFilters((prev) => ({ ...prev, incident_type: event.target.value }))}
              style={styles.input}
            >
              {INCIDENT_TYPES.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>From</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(event) => setFilters((prev) => ({ ...prev, date_from: event.target.value }))}
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>To</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(event) => setFilters((prev) => ({ ...prev, date_to: event.target.value }))}
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Max Records</label>
            <input
              type="number"
              min="1"
              max="100"
              value={filters.max_records}
              onChange={(event) => setFilters((prev) => ({ ...prev, max_records: event.target.value }))}
              style={styles.input}
            />
          </div>

          <div style={{ ...styles.field, justifyContent: "flex-end" }}>
            {billingBlocked ? (
              <div style={styles.billingCtaWrap}>
                <div style={styles.billingInlineMeta}>
                  <strong>{primaryUsage?.institution_name || "this institution"}</strong>
                  <span>
                    {!primaryUsage
                      ? "AI access unavailable"
                      : primaryUsage.limit === null
                        ? "Unlimited quota"
                        : `${formatNumber(primaryUsage.remaining)} of ${formatNumber(primaryUsage.limit)} remaining`}
                  </span>
                </div>
                <button
                  type="button"
                  style={styles.billingButton}
                  onClick={() => {
                    window.location.href = billingPath;
                  }}
                >
                  Upgrade for AI Insights
                </button>
              </div>
            ) : (
              <button type="submit" style={styles.primaryButton} disabled={loading || bootLoading}>
                {loading ? "Generating..." : "Generate Insights"}
              </button>
            )}
          </div>
        </form>
      </section>

      {error && <div style={styles.errorBanner}>{error}</div>}
      {billingBlocked && (
        <div style={styles.noteCard}>
          AI access is blocked by the current plan or the monthly AI quota. Open billing to upgrade or raise the limit.
        </div>
      )}
      {primaryUsage && (
        <div style={styles.noteCard}>
          AI quota this month: {formatNumber(primaryUsage.used)} / {primaryUsage.limit === null ? "Unlimited" : formatNumber(primaryUsage.limit)} used
          {primaryUsage.remaining !== null ? ` — ${formatNumber(primaryUsage.remaining)} remaining` : ""}
        </div>
      )}
      {bootLoading && <div style={styles.noteCard}>Loading AI insights workspace...</div>}

      
      {analytics && (
        <section style={{ ...styles.resultsWrap, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.resultsHeader}>
            <div>
              <h2 style={{ ...styles.sectionTitle, color: theme.text }}>Operational KPIs</h2>
              <p style={{ ...styles.sectionMeta, color: theme.mutedText }}>
                Reporting window: {analytics.period?.start} to {analytics.period?.end}
              </p>
            </div>
          </div>

          <div style={styles.kpiGrid}>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>Total Incidents</div>
              <div style={styles.kpiValue}>{formatNumber(analytics.kpis?.total_incidents)}</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>Open Follow-ups</div>
              <div style={styles.kpiValue}>{formatNumber(analytics.kpis?.open_followups)}</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>Resolution Rate</div>
              <div style={styles.kpiValue}>{formatPct(analytics.kpis?.resolution_rate)}</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>Avg Open Age (Days)</div>
              <div style={styles.kpiValue}>{formatNumber(analytics.kpis?.avg_open_age_days)}</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiLabel}>Incidents (7 Days)</div>
              <div style={styles.kpiValue}>{formatNumber(analytics.kpis?.incidents_last_7_days)}</div>
            </div>
          </div>

          <div style={styles.dualGrid}>
            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>Daily Volume Trend</h3>
              <div style={styles.sparkline}>
                {(analytics.trends?.daily_counts || []).map((item) => (
                  <div
                    key={item.date}
                    title={`${item.date}: ${item.count}`}
                    style={{
                      ...styles.sparklineBar,
                      height: `${Math.max(6, item.count * 6)}px`,
                    }}
                  />
                ))}
              </div>
              <div style={styles.smallNote}>Bars scale to daily counts in the selected window.</div>
            </div>

            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>Incident Type Trend</h3>
              {(analytics.trends?.type_trends || []).length === 0 ? (
                <div style={styles.emptySmall}>No trend data available.</div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Current</th>
                      <th style={styles.th}>Previous</th>
                      <th style={styles.th}>Delta</th>
                      <th style={styles.th}>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.trends.type_trends.map((item) => (
                      <tr key={item.incident_type}>
                        <td style={styles.td}>{item.incident_type}</td>
                        <td style={styles.td}>{item.current_count}</td>
                        <td style={styles.td}>{item.previous_count}</td>
                        <td style={styles.td}>{item.delta}</td>
                        <td style={styles.td}>{formatPct(item.pct_change)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div style={styles.dualGrid}>
            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>Anomaly Signals</h3>
              {(analytics.anomalies || []).length === 0 ? (
                <div style={styles.emptySmall}>No spikes detected for this period.</div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Current</th>
                      <th style={styles.th}>Previous</th>
                      <th style={styles.th}>Reason</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.anomalies.map((item) => (
                      <tr key={`${item.incident_type}-${item.reason}`}>
                        <td style={styles.td}>{item.incident_type}</td>
                        <td style={styles.td}>{item.current_count}</td>
                        <td style={styles.td}>{item.previous_count}</td>
                        <td style={styles.td}>{item.reason.replace("_", " ")}</td>
                        <td style={styles.td}>
                          <button
                            style={styles.smallButton}
                            onClick={() =>
                              runDrilldown(`Spike: ${item.incident_type}`, {
                                incident_type: item.incident_type,
                              })
                            }
                          >
                            View Incidents
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>Facility Risk Heat</h3>
              {(analytics.facility_risk || []).length === 0 ? (
                <div style={styles.emptySmall}>No facility data available.</div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Facility</th>
                      <th style={styles.th}>Total</th>
                      <th style={styles.th}>Open</th>
                      <th style={styles.th}>Avg Open Age</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.facility_risk.map((item) => (
                      <tr key={item.facility_id}>
                        <td style={styles.td}>{item.facility_name}</td>
                        <td style={styles.td}>{item.total_incidents}</td>
                        <td style={styles.td}>{item.open_followups}</td>
                        <td style={styles.td}>{item.avg_open_age_days} days</td>
                        <td style={styles.td}>
                          <button
                            style={styles.smallButton}
                            onClick={() =>
                              runDrilldown(`Facility: ${item.facility_name}`, {
                                facility_id: item.facility_id === "unassigned" ? null : item.facility_id,
                              })
                            }
                          >
                            View Incidents
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div style={styles.panel}>
            <h3 style={styles.panelTitle}>Drilldown Results</h3>
            {drilldownLoading && <div style={styles.emptySmall}>Loading incidents...</div>}
            {drilldownError && <div style={styles.errorBanner}>{drilldownError}</div>}
            {!drilldownLoading && !drilldownError && drilldownItems.length === 0 && (
              <div style={styles.emptySmall}>Select a drilldown action to see matching incidents.</div>
            )}
            {drilldownItems.length > 0 && (
              <>
                <div style={styles.smallNote}>{drilldownLabel}</div>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>OB</th>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Facility</th>
                      <th style={styles.th}>Occurred</th>
                      <th style={styles.th}>Follow-up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drilldownItems.map((item) => (
                      <tr key={item.id}>
                        <td style={styles.td}>{item.ob_number}</td>
                        <td style={styles.td}>{item.incident_type}</td>
                        <td style={styles.td}>{item.facility_name || item.facility || "-"}</td>
                        <td style={styles.td}>{item.occurred_at}</td>
                        <td style={styles.td}>{item.follow_up_status || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </section>
      )}
{result && !bootLoading && (
        <section style={{ ...styles.resultsWrap, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.resultsHeader}>
            <div>
              <h2 style={{ ...styles.sectionTitle, color: theme.text }}>Insight Report</h2>
              <p style={{ ...styles.sectionMeta, color: theme.mutedText }}>
                Analyzed {result.meta?.incident_count || 0} incident records using {result.meta?.model || "local fallback"}.
              </p>
            </div>
            <span style={{ ...styles.riskBadge, backgroundColor: riskTone.background, color: riskTone.color }}>
              {result.insights?.risk_level || "low"} risk
            </span>
          </div>

          <div style={styles.summaryBox}>{result.insights?.summary}</div>

          <div style={styles.metricsGrid}>
            <MetricCard title="Priority Actions" items={result.insights?.priority_actions} />
            <MetricCard title="Follow-up Gaps" items={result.insights?.follow_up_gaps} />
            <MetricCard title="Top Patterns" items={result.insights?.top_patterns} />
            <MetricCard title="Recommended Queries" items={result.insights?.recommended_queries} />
          </div>

          <div style={styles.dualGrid}>
            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>Incident Breakdown</h3>
              {(result.insights?.incident_breakdown || []).length === 0 ? (
                <div style={styles.emptySmall}>No breakdown available.</div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.insights.incident_breakdown.map((item) => (
                      <tr key={`${item.incident_type}-${item.count}`}>
                        <td style={styles.td}>{item.incident_type}</td>
                        <td style={styles.td}>{item.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>Facility Hotspots</h3>
              {(result.insights?.facility_hotspots || []).length === 0 ? (
                <div style={styles.emptySmall}>No hotspots identified.</div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Facility</th>
                      <th style={styles.th}>Incidents</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.insights.facility_hotspots.map((item) => (
                      <tr key={`${item.facility_name}-${item.incident_count}`}>
                        <td style={styles.td}>{item.facility_name}</td>
                        <td style={styles.td}>{item.incident_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

const MetricCard = ({ title, items = [] }) => (
  <div style={styles.metricCard}>
    <h3 style={styles.metricTitle}>{title}</h3>
    {items.length === 0 ? (
      <div style={styles.emptySmall}>Nothing flagged.</div>
    ) : (
      <ul style={styles.list}>
        {items.map((item) => (
          <li key={item} style={styles.listItem}>{item}</li>
        ))}
      </ul>
    )}
  </div>
);

const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    minHeight: "100%",
  },
  hero: {
    border: "1px solid #d0e6d2",
    borderRadius: "18px",
    padding: "22px",
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
  },
  eyebrow: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 700,
    color: "#166534",
    marginBottom: "8px",
  },
  title: {
    margin: 0,
    fontSize: "30px",
    lineHeight: 1.2,
  },
  subtitle: {
    margin: "10px 0 0",
    fontSize: "14px",
    maxWidth: "700px",
  },
  profileChip: {
    display: "grid",
    gap: "4px",
    alignSelf: "flex-start",
    padding: "12px 14px",
    borderRadius: "14px",
    backgroundColor: "#0f172a",
    color: "#fff",
    minWidth: "160px",
  },
  formCard: {
    border: "1px solid #d0e6d2",
    borderRadius: "18px",
    padding: "18px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
    alignItems: "end",
  },
  field: {
    display: "grid",
    gap: "6px",
  },
  label: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#475569",
  },
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "10px 12px",
    fontSize: "14px",
    width: "100%",
    boxSizing: "border-box",
  },
  primaryButton: {
    border: "none",
    borderRadius: "12px",
    padding: "11px 16px",
    backgroundColor: "#0f5132",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  billingButton: {
    border: "none",
    borderRadius: "12px",
    padding: "11px 16px",
    backgroundColor: "#0f766e",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
  },
  errorBanner: {
    border: "1px solid #fecaca",
    borderRadius: "14px",
    padding: "12px 14px",
    backgroundColor: "#fef2f2",
    color: "#991b1b",
  },
    noteCard: {
    border: "1px dashed #cbd5e1",
    borderRadius: "14px",
    padding: "16px",
    color: "#64748b",
    backgroundColor: "#f8fafc",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "12px",
  },
  kpiCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    padding: "12px",
    backgroundColor: "#fff",
  },
  kpiLabel: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#64748b",
  },
  kpiValue: {
    fontSize: "20px",
    fontWeight: 700,
    color: "#0f172a",
    marginTop: "6px",
  },
  sparkline: {
    display: "flex",
    alignItems: "flex-end",
    gap: "4px",
    minHeight: "80px",
  },
  sparklineBar: {
    width: "8px",
    borderRadius: "6px",
    backgroundColor: "#16a34a",
  },
  smallNote: {
    marginTop: "8px",
    fontSize: "12px",
    color: "#64748b",
  },
  smallButton: {
    padding: "6px 10px",
    fontSize: "12px",
    borderRadius: "6px",
    border: "1px solid #0f766e",
    backgroundColor: "#0f766e",
    color: "#fff",
    cursor: "pointer",
  },
  resultsWrap: {
    border: "1px solid #d0e6d2",
    borderRadius: "18px",
    padding: "18px",
    display: "grid",
    gap: "16px",
  },
  resultsHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "22px",
  },
  sectionMeta: {
    margin: "6px 0 0",
    fontSize: "13px",
  },
  riskBadge: {
    padding: "8px 12px",
    borderRadius: "999px",
    fontWeight: 700,
    textTransform: "capitalize",
  },
  summaryBox: {
    padding: "14px 16px",
    borderRadius: "16px",
    backgroundColor: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#14532d",
    fontSize: "15px",
    lineHeight: 1.5,
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  },
  metricCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "14px",
    backgroundColor: "#fff",
  },
  metricTitle: {
    margin: "0 0 10px",
    fontSize: "15px",
    color: "#0f172a",
  },
  dualGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "12px",
  },
  panel: {
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "14px",
    backgroundColor: "#fff",
  },
  panelTitle: {
    margin: "0 0 10px",
    fontSize: "15px",
    color: "#0f172a",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    fontSize: "12px",
    textTransform: "uppercase",
    color: "#64748b",
    paddingBottom: "8px",
  },
  td: {
    borderTop: "1px solid #e2e8f0",
    padding: "10px 0",
    color: "#0f172a",
    fontSize: "14px",
  },
  list: {
    margin: 0,
    paddingLeft: "18px",
    display: "grid",
    gap: "8px",
  },
  listItem: {
    color: "#0f172a",
    fontSize: "14px",
  },
  emptySmall: {
    color: "#64748b",
    fontSize: "13px",
  },
};

export default AiIncidentInsightsPage;






































