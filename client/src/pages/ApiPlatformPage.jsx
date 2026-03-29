import React from "react";

import { useColorMode } from "../utils/useColorMode";

const integrationPillars = [
  {
    title: "REST APIs",
    description: "Connect Doria to CRMs, CAD systems, ERPs, dispatch tools, and internal dashboards using structured HTTPS endpoints.",
    icon: "</>",
  },
  {
    title: "Webhook Events",
    description: "Push incident, facility, emergency, and status-change updates into existing platforms the moment Doria records them.",
    icon: "~>",
  },
  {
    title: "Secure Access",
    description: "Use scoped API keys, service accounts, and auditable integration flows so external systems only access what they should.",
    icon: "[]",
  },
];

const integrationTargets = [
  "Existing government platforms",
  "Hospital and emergency dispatch systems",
  "Security command centers",
  "Enterprise data warehouses",
  "Third-party analytics and reporting tools",
  "Partner mobile or citizen-service apps",
];

const apiCapabilities = [
  { label: "Incidents API", value: "Sync incident intake, updates, status, and ownership" },
  { label: "Facilities API", value: "Share facility metadata, geolocation, readiness, and contact data" },
  { label: "Emergency Services API", value: "Expose service directories and routing information" },
  { label: "Intelligence API", value: "Deliver area-level patterns and operational summaries" },
  { label: "Webhook Registry", value: "Register event callbacks for downstream systems" },
  { label: "Audit Visibility", value: "Track integration activity for trust and troubleshooting" },
];

const exampleEndpoints = [
  "GET /api/integrations/incidents",
  "POST /api/integrations/incidents",
  "GET /api/integrations/facilities",
  "POST /api/integrations/webhooks/subscriptions",
  "GET /api/integrations/health",
];

const deliverySteps = [
  "Create an integration profile for the external platform.",
  "Issue credentials and define which Doria resources it can read or update.",
  "Map records between Doria and the partner platform.",
  "Enable webhooks to push real-time operational changes.",
  "Monitor requests, failures, and sync status from one integration workspace.",
];

const ApiPlatformPage = () => {
  const { theme, isDark } = useColorMode();

  return (
    <div style={{ ...styles.page, backgroundColor: theme.pageBg }}>
      <section
        style={{
          ...styles.hero,
          color: "#ecfdf5",
          background: isDark
            ? "linear-gradient(135deg, #0f766e 0%, #0f172a 100%)"
            : "linear-gradient(135deg, #115e59 0%, #0f5132 55%, #166534 100%)",
        }}
      >
        <div style={styles.heroCopy}>
          <span style={styles.eyebrow}>API Platform</span>
          <h1 style={styles.heroTitle}>Built to integrate Doria with existing platforms</h1>
          <p style={styles.heroText}>
            This workspace is specifically for connecting Doria to the systems organizations already use, including
            dispatch platforms, hospital software, security tools, analytics stacks, and government systems.
          </p>
          <div style={styles.heroBadges}>
            <span style={styles.heroBadge}>Third-party integrations</span>
            <span style={styles.heroBadge}>API-first connectivity</span>
            <span style={styles.heroBadge}>Real-time webhook delivery</span>
          </div>
        </div>

        <div style={styles.heroPanel}>
          <div style={styles.heroPanelLabel}>Integration Scope</div>
          <div style={styles.heroPanelValue}>Unify Doria with the platforms your teams already depend on</div>
          <p style={styles.heroPanelText}>
            Use APIs to pull data into Doria, publish Doria updates outward, and keep critical operations synchronized.
          </p>
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={{ ...styles.sectionTitle, color: theme.text }}>What This API Platform Is For</h2>
          <p style={{ ...styles.sectionText, color: theme.mutedText }}>
            Every element here is framed around interoperability so teams can extend Doria instead of replacing working
            systems overnight.
          </p>
        </div>
        <div style={styles.pillarGrid}>
          {integrationPillars.map((pillar) => (
            <article
              key={pillar.title}
              style={{ ...styles.card, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}
            >
              <div style={styles.cardIcon}>{pillar.icon}</div>
              <h3 style={{ ...styles.cardTitle, color: theme.text }}>{pillar.title}</h3>
              <p style={{ ...styles.cardText, color: theme.mutedText }}>{pillar.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section style={styles.twoColumn}>
        <article style={{ ...styles.panel, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.panelHeader}>
            <h2 style={{ ...styles.sectionTitle, color: theme.text }}>Designed for Existing Platforms</h2>
          </div>
          <div style={styles.listGrid}>
            {integrationTargets.map((target) => (
              <div key={target} style={{ ...styles.listItem, backgroundColor: isDark ? "#0f172a" : "#f6fbf7" }}>
                <span style={styles.listBullet}>+</span>
                <span style={{ color: theme.text }}>{target}</span>
              </div>
            ))}
          </div>
        </article>

        <article style={{ ...styles.panel, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.panelHeader}>
            <h2 style={{ ...styles.sectionTitle, color: theme.text }}>Delivery Model</h2>
          </div>
          <div style={styles.stepList}>
            {deliverySteps.map((step, index) => (
              <div key={step} style={styles.stepItem}>
                <span style={styles.stepNumber}>{index + 1}</span>
                <p style={{ ...styles.stepText, color: theme.mutedText }}>{step}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section style={styles.twoColumn}>
        <article style={{ ...styles.panel, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.panelHeader}>
            <h2 style={{ ...styles.sectionTitle, color: theme.text }}>Core Integration Capabilities</h2>
          </div>
          <div style={styles.capabilityList}>
            {apiCapabilities.map((item) => (
              <div key={item.label} style={styles.capabilityRow}>
                <span style={{ ...styles.capabilityLabel, color: theme.text }}>{item.label}</span>
                <span style={{ ...styles.capabilityValue, color: theme.mutedText }}>{item.value}</span>
              </div>
            ))}
          </div>
        </article>

        <article style={{ ...styles.panel, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
          <div style={styles.panelHeader}>
            <h2 style={{ ...styles.sectionTitle, color: theme.text }}>Example API Surface</h2>
          </div>
          <div style={styles.endpointList}>
            {exampleEndpoints.map((endpoint) => (
              <code
                key={endpoint}
                style={{
                  ...styles.endpointItem,
                  backgroundColor: isDark ? "#0b1220" : "#f0fdf4",
                  color: isDark ? "#a7f3d0" : "#166534",
                  borderColor: theme.cardBorder,
                }}
              >
                {endpoint}
              </code>
            ))}
          </div>
          <p style={{ ...styles.endpointNote, color: theme.mutedText }}>
            The naming makes the intent explicit: this API layer exists to power integrations with other platforms.
          </p>
        </article>
      </section>
    </div>
  );
};

const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "22px",
  },
  hero: {
    borderRadius: "24px",
    padding: "28px",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.5fr) minmax(280px, 0.9fr)",
    gap: "20px",
    boxShadow: "0 20px 40px rgba(15, 81, 50, 0.14)",
  },
  heroCopy: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  eyebrow: {
    display: "inline-flex",
    width: "fit-content",
    padding: "6px 12px",
    borderRadius: "999px",
    backgroundColor: "rgba(255,255,255,0.14)",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  heroTitle: {
    margin: 0,
    fontSize: "38px",
    lineHeight: 1.1,
    maxWidth: "720px",
  },
  heroText: {
    margin: 0,
    fontSize: "16px",
    lineHeight: 1.7,
    maxWidth: "720px",
  },
  heroBadges: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  heroBadge: {
    padding: "8px 12px",
    borderRadius: "999px",
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.16)",
    fontSize: "13px",
    fontWeight: 600,
  },
  heroPanel: {
    borderRadius: "20px",
    padding: "20px",
    backgroundColor: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.16)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: "12px",
  },
  heroPanelLabel: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 700,
    opacity: 0.82,
  },
  heroPanelValue: {
    fontSize: "24px",
    fontWeight: 700,
    lineHeight: 1.2,
  },
  heroPanelText: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.6,
    opacity: 0.92,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  sectionHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 700,
  },
  sectionText: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.6,
    maxWidth: "760px",
  },
  pillarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  card: {
    border: "1px solid #d0e6d2",
    borderRadius: "18px",
    padding: "18px",
    boxShadow: "0 10px 20px rgba(15, 81, 50, 0.06)",
  },
  cardIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0f766e 0%, #115e59 100%)",
    color: "#ecfdf5",
    fontWeight: 700,
    marginBottom: "14px",
  },
  cardTitle: {
    margin: "0 0 8px",
    fontSize: "18px",
  },
  cardText: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.6,
  },
  twoColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "18px",
  },
  panel: {
    border: "1px solid #d0e6d2",
    borderRadius: "20px",
    padding: "20px",
    boxShadow: "0 12px 24px rgba(15, 81, 50, 0.06)",
  },
  panelHeader: {
    marginBottom: "16px",
  },
  listGrid: {
    display: "grid",
    gap: "10px",
  },
  listItem: {
    borderRadius: "14px",
    padding: "14px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  listBullet: {
    width: "24px",
    height: "24px",
    borderRadius: "999px",
    backgroundColor: "#14b8a6",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    flexShrink: 0,
  },
  stepList: {
    display: "grid",
    gap: "12px",
  },
  stepItem: {
    display: "grid",
    gridTemplateColumns: "36px minmax(0, 1fr)",
    gap: "12px",
    alignItems: "start",
  },
  stepNumber: {
    width: "36px",
    height: "36px",
    borderRadius: "12px",
    backgroundColor: "#ccfbf1",
    color: "#115e59",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
  },
  stepText: {
    margin: "4px 0 0",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  capabilityList: {
    display: "grid",
    gap: "12px",
  },
  capabilityRow: {
    display: "grid",
    gridTemplateColumns: "minmax(140px, 180px) minmax(0, 1fr)",
    gap: "14px",
    alignItems: "start",
    paddingBottom: "12px",
    borderBottom: "1px solid rgba(148, 163, 184, 0.18)",
  },
  capabilityLabel: {
    fontSize: "13px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  capabilityValue: {
    fontSize: "14px",
    lineHeight: 1.6,
  },
  endpointList: {
    display: "grid",
    gap: "10px",
  },
  endpointItem: {
    display: "block",
    border: "1px solid #d0e6d2",
    borderRadius: "14px",
    padding: "14px",
    fontSize: "13px",
  },
  endpointNote: {
    margin: "14px 0 0",
    fontSize: "13px",
    lineHeight: 1.6,
  },
};

export default ApiPlatformPage;
