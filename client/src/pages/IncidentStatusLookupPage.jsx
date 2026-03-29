import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { INCIDENTS_API_BASE as INCIDENTS_API } from "../utils/apiBase";

const defaultInquiryForm = {
  reference: "",
  reporter_contact: "",
};

const IncidentStatusLookupPage = () => {
  const navigate = useNavigate();
  const [inquiryForm, setInquiryForm] = useState(defaultInquiryForm);
  const [inquiring, setInquiring] = useState(false);
  const [inquiryResult, setInquiryResult] = useState(null);
  const [inquiryError, setInquiryError] = useState("");

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
          <div style={styles.eyebrow}>Incident Follow-up</div>
          <h1 style={styles.title}>Check incident status using OB number</h1>
          <p style={styles.subtitle}>
            Enter the OB number or public reference together with the contact used during reporting to request an update
            on an incident and see current status plus nearby live security intel.
          </p>
        </div>
        <div style={styles.heroPanel}>
          <div style={styles.heroStatLabel}>Lookup inputs</div>
          <div style={styles.heroStat}>OB number + contact</div>
          <div style={styles.heroNote}>
            This flow is useful for public users who need status visibility without logging into the platform.
          </div>
        </div>
      </div>

      <form onSubmit={handleInquiry} style={styles.card}>
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
            <div style={styles.lookupRow}>Proxy phone: {inquiryResult.incident?.proxy_phone_number || "-"}</div>
            <div style={styles.lookupRow}>Occurred at: {inquiryResult.incident?.occurred_at || "-"}</div>
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
    border: "1px solid #bfdbfe",
    backgroundColor: "#fff",
    color: "#1d4ed8",
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
    background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 55%, #dbeafe 180%)",
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
    color: "#dbeafe",
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
    color: "#eff6ff",
    maxWidth: "720px",
  },
  heroPanel: {
    borderRadius: "22px",
    padding: "18px",
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(219,234,254,0.35)",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    justifyContent: "center",
  },
  heroStatLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#dbeafe",
    fontWeight: 800,
  },
  heroStat: {
    fontSize: "28px",
    fontWeight: 800,
  },
  heroNote: {
    fontSize: "14px",
    lineHeight: 1.5,
    color: "#eff6ff",
  },
  card: {
    maxWidth: "1100px",
    margin: "0 auto",
    backgroundColor: "#fff",
    border: "1px solid #bfdbfe",
    borderRadius: "24px",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    boxShadow: "0 18px 40px rgba(30, 64, 175, 0.08)",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "16px",
  },
  label: {
    display: "block",
    marginBottom: "6px",
    fontSize: "13px",
    fontWeight: 700,
    color: "#1d4ed8",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: "14px",
    border: "1px solid #bfdbfe",
    padding: "12px 14px",
    fontSize: "14px",
    backgroundColor: "#f8fbff",
  },
  primaryButton: {
    border: "none",
    borderRadius: "16px",
    padding: "14px 18px",
    background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)",
    color: "#fff",
    fontWeight: 800,
    fontSize: "15px",
    cursor: "pointer",
    alignSelf: "flex-start",
  },
  errorBanner: {
    padding: "14px 16px",
    backgroundColor: "#fee2e2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    borderRadius: "16px",
    fontWeight: 700,
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
};

export default IncidentStatusLookupPage;
