import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { INCIDENTS_API_BASE as INCIDENTS_API } from "../utils/apiBase";

const INCIDENT_TYPES = [
  { value: "robbery", label: "Robbery" },
  { value: "assault", label: "Assault" },
  { value: "accident", label: "Accident" },
  { value: "missing_person", label: "Missing Person" },
  { value: "murder", label: "Murder" },
  { value: "theft", label: "Theft" },
  { value: "other", label: "Other" },
];

const getDefaultOccurredAt = () => {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
};

const defaultForm = {
  reporter_name: "",
  reporter_contact: "",
  incident_type: "",
  description: "",
  public_location_hint: "",
  latitude: "",
  longitude: "",
  occurred_at: getDefaultOccurredAt(),
  image: null,
};

const defaultInquiryForm = {
  reference: "",
  reporter_contact: "",
};

const PublicIncidentReportPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [inquiryForm, setInquiryForm] = useState(defaultInquiryForm);
  const [inquiring, setInquiring] = useState(false);
  const [inquiryResult, setInquiryResult] = useState(null);
  const [inquiryError, setInquiryError] = useState("");

  const statusTone = useMemo(() => {
    if (!result) return null;
    return result.matched ? styles.successCard : styles.warningCard;
  }, [result]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setResult(null);

    try {
      const payload = new FormData();
      if (form.reporter_name) payload.append("reporter_name", form.reporter_name);
      if (form.reporter_contact) payload.append("reporter_contact", form.reporter_contact);
      if (form.incident_type) payload.append("incident_type", form.incident_type);
      if (form.description) payload.append("description", form.description);
      if (form.public_location_hint) payload.append("public_location_hint", form.public_location_hint);
      if (form.latitude) payload.append("latitude", form.latitude);
      if (form.longitude) payload.append("longitude", form.longitude);
      payload.append("occurred_at", form.occurred_at);
      if (form.image) payload.append("image", form.image);

      const response = await fetch(`${INCIDENTS_API}/public-report/`, {
        method: "POST",
        body: payload,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to submit incident report");
      }
      setResult(data);
      if (data.matched) {
        setForm({ ...defaultForm, occurred_at: getDefaultOccurredAt(), image: null });
      }
    } catch (submitError) {
      setError(submitError.message || "Failed to submit incident report");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInquiry = async (event) => {
    event.preventDefault();
    setInquiring(true);
    setInquiryError("");
    setInquiryResult(null);
    try {
      const response = await fetch(`${INCIDENTS_API}/public-inquiry/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: inquiryForm.reference.trim(),
          reporter_contact: inquiryForm.reporter_contact.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to find incident");
      }
      setInquiryResult(data);
    } catch (lookupError) {
      setInquiryError(lookupError.message || "Failed to find incident");
    } finally {
      setInquiring(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.backRow}>
        <button type="button" onClick={() => navigate("/")} style={styles.backButton}>
          Back to Home
        </button>
      </div>

      <div style={styles.hero}>
        <div style={styles.heroText}>
          <div style={styles.eyebrow}>Public Incident Report</div>
          <h1 style={styles.title}>Report an incident without logging in</h1>
          <p style={styles.subtitle}>
            Doria will use AI to route your report to the most relevant institution facility already registered on the platform. You can submit typed details, an image, or both. If no relevant facility matches, you will know immediately.
          </p>
        </div>
        <div style={styles.heroPanel}>
          <div style={styles.heroStatLabel}>How it works</div>
          <div style={styles.heroStat}>Submit details or image</div>
          <div style={styles.heroNote}>We evaluate typed details, uploaded image evidence, place hints, and coordinates before routing the report.</div>
        </div>
      </div>

      {error ? <div style={styles.errorBanner}>{error}</div> : null}
      {result ? (
        <div style={{ ...styles.resultCard, ...statusTone }}>
          <h2 style={styles.resultTitle}>{result.matched ? "Matched and submitted" : "No institution match yet"}</h2>
          <p style={styles.resultText}>{result.message}</p>
          {result.matched ? (
            <div style={styles.resultMeta}>
              <div>Institution: {result.match?.institution_name || "-"}</div>
              <div>Facility: {result.match?.facility_name || "Not specific"}</div>
              <div>Reference: {result.incident?.reference || "-"}</div>
              <div>Proxy phone: {result.incident?.proxy_phone_number || "-"}</div>
            </div>
          ) : (
            <div style={styles.resultMeta}>
              <div>Reason: {result.reason || "No close institution or facility was identified."}</div>
            </div>
          )}
          {result.analysis ? (
            <div style={styles.analysisBox}>
              <div style={styles.analysisTitle}>AI extraction</div>
              {result.analysis.incident_type ? <div>Incident type: {result.analysis.incident_type}</div> : null}
              {result.analysis.location_hint ? <div>Location hint: {result.analysis.location_hint}</div> : null}
              {result.analysis.description ? <div>Summary: {result.analysis.description}</div> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} style={styles.formCard}>
        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>Your name</label>
            <input
              value={form.reporter_name}
              onChange={(event) => setForm((prev) => ({ ...prev, reporter_name: event.target.value }))}
              style={styles.input}
              placeholder="Optional"
            />
          </div>
          <div>
            <label style={styles.label}>Phone or contact</label>
            <input
              value={form.reporter_contact}
              onChange={(event) => setForm((prev) => ({ ...prev, reporter_contact: event.target.value }))}
              style={styles.input}
              placeholder="Optional"
            />
          </div>
          <div>
            <label style={styles.label}>Incident type</label>
            <select
              value={form.incident_type}
              onChange={(event) => setForm((prev) => ({ ...prev, incident_type: event.target.value }))}
              style={styles.input}
            >
              <option value="">Let AI infer from image</option>
              {INCIDENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={styles.label}>Occurred at</label>
            <input
              type="datetime-local"
              value={form.occurred_at}
              onChange={(event) => setForm((prev) => ({ ...prev, occurred_at: event.target.value }))}
              style={styles.input}
              required
            />
          </div>
          <div style={styles.full}>
            <label style={styles.label}>What happened?</label>
            <textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              style={styles.textarea}
              placeholder="Describe the incident clearly, or upload an image and let AI help extract the details."
              rows={5}
            />
          </div>
          <div style={styles.full}>
            <label style={styles.label}>Photo evidence</label>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setForm((prev) => ({ ...prev, image: event.target.files?.[0] || null }))}
              style={styles.input}
            />
            <div style={styles.helperText}>
              Optional. If you upload an image, AI will extract visible incident clues and help route the report.
            </div>
          </div>
          <div style={styles.full}>
            <label style={styles.label}>Place, landmark, county, or sub-county</label>
            <input
              value={form.public_location_hint}
              onChange={(event) => setForm((prev) => ({ ...prev, public_location_hint: event.target.value }))}
              style={styles.input}
              placeholder="Example: Westlands roundabout, Nairobi. Required if you do not provide coordinates."
            />
          </div>
          <div>
            <label style={styles.label}>Latitude</label>
            <input
              value={form.latitude}
              onChange={(event) => setForm((prev) => ({ ...prev, latitude: event.target.value }))}
              style={styles.input}
              placeholder="-1.286389"
            />
          </div>
          <div>
            <label style={styles.label}>Longitude</label>
            <input
              value={form.longitude}
              onChange={(event) => setForm((prev) => ({ ...prev, longitude: event.target.value }))}
              style={styles.input}
              placeholder="36.817223"
            />
          </div>
        </div>

        <button type="submit" disabled={submitting} style={{ ...styles.primaryButton, opacity: submitting ? 0.7 : 1 }}>
          {submitting ? "Submitting..." : "Submit incident report"}
        </button>
      </form>

      <form onSubmit={handleInquiry} style={styles.inquiryCard}>
        <h2 style={styles.inquiryTitle}>Check your report status using OB number or reference</h2>
        <p style={styles.inquirySubtitle}>
          Enter your OB number or public report reference and the same contact used during submission to see current status and nearby live security signals.
        </p>
        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>OB number or reference</label>
            <input
              value={inquiryForm.reference}
              onChange={(event) => setInquiryForm((prev) => ({ ...prev, reference: event.target.value }))}
              style={styles.input}
              placeholder="Example: PUB-20260329010101"
              required
            />
          </div>
          <div>
            <label style={styles.label}>Reporter contact</label>
            <input
              value={inquiryForm.reporter_contact}
              onChange={(event) => setInquiryForm((prev) => ({ ...prev, reporter_contact: event.target.value }))}
              style={styles.input}
              placeholder="Phone or contact used when reporting"
              required
            />
          </div>
        </div>
        {inquiryError ? <div style={styles.errorBanner}>{inquiryError}</div> : null}
        {inquiryResult?.found ? (
          <div style={styles.lookupResult}>
            <div style={styles.lookupHeading}>Incident status</div>
            <div style={styles.lookupRow}>Reference: {inquiryResult.incident?.reference || "-"}</div>
            <div style={styles.lookupRow}>Status: {inquiryResult.incident?.status || "-"}</div>
            <div style={styles.lookupRow}>Institution: {inquiryResult.incident?.institution_name || "-"}</div>
            <div style={styles.lookupRow}>Facility: {inquiryResult.incident?.facility_name || "-"}</div>
            <div style={styles.lookupHeading}>Live security intel</div>
            {inquiryResult.live_intel?.articles?.length ? (
              <div style={styles.lookupList}>
                {inquiryResult.live_intel.articles.map((article) => (
                  <a key={article.link} href={article.link} target="_blank" rel="noreferrer" style={styles.lookupLink}>
                    {article.title}
                  </a>
                ))}
              </div>
            ) : (
              <div style={styles.lookupRow}>No live articles were available for this area right now.</div>
            )}
          </div>
        ) : null}
        <button type="submit" disabled={inquiring} style={{ ...styles.primaryButton, opacity: inquiring ? 0.7 : 1 }}>
          {inquiring ? "Checking..." : "Check incident status"}
        </button>
      </form>
    </div>
  );
};

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f7fbf8 0%, #eef6f0 100%)",
    padding: "28px 20px 48px",
    color: "#0f172a",
  },
  backRow: {
    maxWidth: "1100px",
    margin: "0 auto 16px",
  },
  backButton: {
    border: "1px solid #bbf7d0",
    backgroundColor: "#fff",
    color: "#166534",
    borderRadius: "999px",
    padding: "10px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  hero: {
    maxWidth: "1100px",
    margin: "0 auto 20px",
    borderRadius: "28px",
    padding: "28px",
    background: "linear-gradient(135deg, #14532d 0%, #166534 55%, #dcfce7 180%)",
    color: "#fff",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.5fr) minmax(280px, 0.8fr)",
    gap: "18px",
  },
  heroText: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  eyebrow: {
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#dcfce7",
  },
  title: {
    margin: 0,
    fontSize: "38px",
    lineHeight: 1.05,
  },
  subtitle: {
    margin: 0,
    fontSize: "16px",
    lineHeight: 1.6,
    color: "#ecfdf5",
    maxWidth: "720px",
  },
  heroPanel: {
    borderRadius: "22px",
    padding: "18px",
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(220,252,231,0.35)",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    justifyContent: "center",
  },
  heroStatLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#dcfce7",
    fontWeight: 800,
  },
  heroStat: {
    fontSize: "28px",
    fontWeight: 800,
  },
  heroNote: {
    fontSize: "14px",
    lineHeight: 1.5,
    color: "#f0fdf4",
  },
  errorBanner: {
    maxWidth: "1100px",
    margin: "0 auto 16px",
    padding: "14px 16px",
    backgroundColor: "#fee2e2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    borderRadius: "16px",
    fontWeight: 700,
  },
  resultCard: {
    maxWidth: "1100px",
    margin: "0 auto 16px",
    borderRadius: "20px",
    padding: "18px",
    border: "1px solid transparent",
  },
  successCard: {
    backgroundColor: "#ecfdf5",
    borderColor: "#86efac",
    color: "#14532d",
  },
  warningCard: {
    backgroundColor: "#fff7ed",
    borderColor: "#fdba74",
    color: "#9a3412",
  },
  resultTitle: {
    margin: "0 0 8px",
    fontSize: "20px",
  },
  resultText: {
    margin: "0 0 10px",
    fontSize: "15px",
    lineHeight: 1.55,
  },
  resultMeta: {
    display: "grid",
    gap: "6px",
    fontSize: "14px",
    fontWeight: 600,
  },
  analysisBox: {
    marginTop: "12px",
    display: "grid",
    gap: "6px",
    padding: "12px",
    borderRadius: "14px",
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  analysisTitle: {
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  formCard: {
    maxWidth: "1100px",
    margin: "0 auto",
    backgroundColor: "#fff",
    border: "1px solid #d1fae5",
    borderRadius: "24px",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    boxShadow: "0 18px 40px rgba(20, 83, 45, 0.08)",
  },
  inquiryCard: {
    maxWidth: "1100px",
    margin: "18px auto 0",
    backgroundColor: "#fff",
    border: "1px solid #bfdbfe",
    borderRadius: "24px",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    boxShadow: "0 18px 40px rgba(30, 64, 175, 0.08)",
  },
  inquiryTitle: {
    margin: 0,
    fontSize: "24px",
    color: "#1e3a8a",
  },
  inquirySubtitle: {
    margin: 0,
    fontSize: "14px",
    color: "#334155",
    lineHeight: 1.5,
  },
  lookupResult: {
    marginTop: "8px",
    borderRadius: "16px",
    border: "1px solid #bfdbfe",
    backgroundColor: "#eff6ff",
    padding: "12px",
    display: "grid",
    gap: "6px",
  },
  lookupHeading: {
    marginTop: "2px",
    fontWeight: 800,
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#1d4ed8",
  },
  lookupRow: {
    fontSize: "14px",
    color: "#0f172a",
  },
  lookupList: {
    display: "grid",
    gap: "6px",
  },
  lookupLink: {
    color: "#1e40af",
    fontWeight: 600,
    textDecoration: "none",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "16px",
  },
  full: {
    gridColumn: "1 / -1",
  },
  label: {
    display: "block",
    marginBottom: "6px",
    fontSize: "13px",
    fontWeight: 700,
    color: "#166534",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  helperText: {
    marginTop: "6px",
    fontSize: "12px",
    color: "#64748b",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: "14px",
    border: "1px solid #bbf7d0",
    padding: "12px 14px",
    fontSize: "14px",
    backgroundColor: "#fafffb",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: "16px",
    border: "1px solid #bbf7d0",
    padding: "14px",
    fontSize: "14px",
    backgroundColor: "#fafffb",
    resize: "vertical",
    fontFamily: "inherit",
  },
  primaryButton: {
    border: "none",
    borderRadius: "16px",
    padding: "14px 18px",
    background: "linear-gradient(135deg, #166534 0%, #15803d 100%)",
    color: "#fff",
    fontWeight: 800,
    fontSize: "15px",
    cursor: "pointer",
    alignSelf: "flex-start",
  },
};

export default PublicIncidentReportPage;
