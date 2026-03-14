import React, { useEffect, useMemo, useState } from "react";

import { apiFetch } from "../utils/apiFetch";
import { useColorMode } from "../utils/useColorMode";

const ACCOUNTS_API = "http://127.0.0.1:8000/api/accounts";
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
  institution_id: "",
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

const AiIncidentInsightsPage = () => {
  const token = localStorage.getItem("access_token");
  const { theme } = useColorMode();
  const [profile, setProfile] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState("");

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
        const [profileRes, institutionsRes] = await Promise.all([
          apiFetch(`${ACCOUNTS_API}/profile/`, { headers }),
          apiFetch(`${ACCOUNTS_API}/institutions/`, { headers }),
        ]);
        const profileData = await profileRes.json();
        const institutionData = await institutionsRes.json();

        if (profileRes.ok) {
          setProfile(profileData.user || null);
        }
        if (institutionsRes.ok) {
          const list = institutionData.institutions || [];
          setInstitutions(list);
          if (list.length === 1) {
            setFilters((prev) => ({ ...prev, institution_id: list[0].id }));
          }
        }
      } catch {
        setError("Failed to load AI insights workspace.");
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
      setError(err.message || "Failed to generate AI insights");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const riskTone = riskColors[result?.insights?.risk_level] || riskColors.low;

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
            <label style={styles.label}>Institution</label>
            <select
              value={filters.institution_id}
              onChange={(event) => setFilters((prev) => ({ ...prev, institution_id: event.target.value }))}
              style={styles.input}
            >
              <option value="">All visible institutions</option>
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
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
            <button type="submit" style={styles.primaryButton} disabled={loading || bootLoading}>
              {loading ? "Generating..." : "Generate Insights"}
            </button>
          </div>
        </form>
      </section>

      {error && <div style={styles.errorBanner}>{error}</div>}
      {bootLoading && <div style={styles.noteCard}>Loading AI insights workspace...</div>}

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
