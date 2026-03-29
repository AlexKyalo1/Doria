import React from "react";

import { useColorMode } from "../utils/useColorMode";

const demoTimeline = [
  {
    time: "0:00 - 0:45",
    title: "Set the problem",
    summary: "Open with the mission: Doria helps institutions detect, coordinate, and resolve incidents from one operating system.",
    action: "Use this moment to explain the audience type and why fragmented systems slow response.",
  },
  {
    time: "0:45 - 1:30",
    title: "Show institution setup",
    summary: "Jump to institutions and facilities to show how a new organization gets onboarded.",
    action: "Point out that the structure starts with the institution, then maps facilities and service coverage.",
    path: "/institutions",
    cta: "Open Institutions",
  },
  {
    time: "1:30 - 2:15",
    title: "Show operational readiness",
    summary: "Move into emergency services and the call center board to show the response layer.",
    action: "Explain that teams can coordinate from one place rather than juggling separate tools.",
    path: "/emergency-services",
    cta: "Open Emergency Services",
  },
  {
    time: "2:15 - 3:15",
    title: "Show live incident handling",
    summary: "Open incidents or incident manager to show capture, tracking, and escalation of events.",
    action: "If you want one strong message here, use speed: report, assign, and follow progress quickly.",
    path: "/incidents/manage",
    cta: "Open Incident Manager",
  },
  {
    time: "3:15 - 4:15",
    title: "Show intelligence",
    summary: "Use AI insights or area intelligence to show analysis, trends, and decision support.",
    action: "Frame this as moving from reactive response to proactive planning.",
    path: "/ai/insights",
    cta: "Open AI Insights",
  },
  {
    time: "4:15 - 5:00",
    title: "Close with expansion",
    summary: "Finish on the API platform and explain how Doria plugs into the systems institutions already use.",
    action: "This is the future-facing close: adopt Doria without replacing every existing tool on day one.",
    path: "/api-platform",
    cta: "Open API Platform",
  },
];

const demoJumps = [
  { label: "Institutions", path: "/institutions", note: "Show who is onboarded." },
  { label: "Facilities", path: "/facilities", note: "Show physical coverage." },
  { label: "Emergency Services", path: "/emergency-services", note: "Show response teams." },
  { label: "Call Center Board", path: "/chat", note: "Show coordination." },
  { label: "Incident Manager", path: "/incidents/manage", note: "Show active response." },
  { label: "AI Insights", path: "/ai/insights", note: "Show intelligence value." },
  { label: "API Platform", path: "/api-platform", note: "Show integration story." },
];

const presenterTips = [
  "Keep the story anchored on one institution instead of trying to explain every module.",
  "If data is thin, narrate the workflow and focus on what each screen enables operationally.",
  "Use the last minute to connect the product to adoption: onboarding, operations, intelligence, integration.",
];

const DemoGuidePage = () => {
  const { theme, isDark } = useColorMode();

  const openPath = (path) => {
    window.location.href = path;
  };

  return (
    <div style={{ ...styles.page, backgroundColor: theme.pageBg }}>
      <section
        style={{
          ...styles.hero,
          background: isDark
            ? "linear-gradient(135deg, #111827 0%, #0f172a 100%)"
            : "linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%)",
          borderColor: theme.cardBorder,
        }}
      >
        <div style={styles.heroTextWrap}>
          <p style={{ ...styles.eyebrow, color: theme.mutedText }}>Presentation Guide</p>
          <h1 style={{ ...styles.heroTitle, color: theme.text }}>5-minute Doria demo</h1>
          <p style={{ ...styles.heroText, color: theme.mutedText }}>
            This page gives you a simple story to present: setup the institution, show the operational workspace,
            demonstrate response, then close with intelligence and integrations.
          </p>
        </div>
        <div
          style={{
            ...styles.heroBadge,
            backgroundColor: isDark ? "#0b1220" : "#0f5132",
            color: "#ffffff",
          }}
        >
          <div style={styles.heroBadgeTime}>5:00</div>
          <div style={styles.heroBadgeLabel}>demo flow</div>
        </div>
      </section>

      <section style={styles.contentGrid}>
        <div style={styles.mainColumn}>
          <section style={{ ...styles.card, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
            <h2 style={{ ...styles.sectionTitle, color: theme.text }}>Suggested flow</h2>
            <div style={styles.timeline}>
              {demoTimeline.map((step) => (
                <article key={step.time} style={{ ...styles.timelineCard, borderColor: theme.cardBorder }}>
                  <div style={styles.timelineTop}>
                    <span style={styles.timeChip}>{step.time}</span>
                    <h3 style={{ ...styles.stepTitle, color: theme.text }}>{step.title}</h3>
                  </div>
                  <p style={{ ...styles.stepSummary, color: theme.text }}>{step.summary}</p>
                  <p style={{ ...styles.stepAction, color: theme.mutedText }}>{step.action}</p>
                  {step.path ? (
                    <button
                      type="button"
                      style={{
                        ...styles.jumpButton,
                        backgroundColor: isDark ? "#0f172a" : "#f0fdf4",
                        borderColor: theme.cardBorder,
                        color: theme.text,
                      }}
                      onClick={() => openPath(step.path)}
                    >
                      {step.cta}
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </div>

        <div style={styles.sideColumn}>
          <section style={{ ...styles.card, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
            <h2 style={{ ...styles.sectionTitle, color: theme.text }}>Quick jumps</h2>
            <div style={styles.jumpList}>
              {demoJumps.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  style={{
                    ...styles.quickJump,
                    backgroundColor: isDark ? "#0f172a" : "#f8faf8",
                    borderColor: theme.cardBorder,
                    color: theme.text,
                  }}
                  onClick={() => openPath(item.path)}
                >
                  <span style={styles.quickJumpLabel}>{item.label}</span>
                  <span style={{ ...styles.quickJumpNote, color: theme.mutedText }}>{item.note}</span>
                </button>
              ))}
            </div>
          </section>

          <section style={{ ...styles.card, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
            <h2 style={{ ...styles.sectionTitle, color: theme.text }}>Presenter notes</h2>
            <div style={styles.tipList}>
              {presenterTips.map((tip) => (
                <div key={tip} style={styles.tipRow}>
                  <span style={styles.tipDot} />
                  <span style={{ ...styles.tipText, color: theme.mutedText }}>{tip}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
};

const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    minHeight: "100%",
  },
  hero: {
    border: "1px solid #d0e6d2",
    borderRadius: "20px",
    padding: "24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    boxShadow: "0 10px 30px rgba(15, 81, 50, 0.08)",
  },
  heroTextWrap: {
    flex: "1 1 520px",
  },
  eyebrow: {
    margin: 0,
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontWeight: 700,
  },
  heroTitle: {
    margin: "10px 0 8px",
    fontSize: "32px",
    lineHeight: 1.15,
  },
  heroText: {
    margin: 0,
    fontSize: "15px",
    lineHeight: 1.6,
    maxWidth: "760px",
  },
  heroBadge: {
    minWidth: "140px",
    borderRadius: "18px",
    padding: "18px 20px",
    textAlign: "center",
    boxShadow: "0 10px 24px rgba(15, 81, 50, 0.18)",
  },
  heroBadgeTime: {
    fontSize: "34px",
    fontWeight: 800,
    lineHeight: 1,
  },
  heroBadgeLabel: {
    marginTop: "6px",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "16px",
  },
  mainColumn: {
    minWidth: 0,
  },
  sideColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  card: {
    border: "1px solid #d0e6d2",
    borderRadius: "16px",
    padding: "18px",
    boxShadow: "0 6px 18px rgba(15, 81, 50, 0.06)",
  },
  sectionTitle: {
    margin: "0 0 14px",
    fontSize: "18px",
    fontWeight: 700,
  },
  timeline: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  timelineCard: {
    border: "1px solid #d0e6d2",
    borderRadius: "14px",
    padding: "14px",
  },
  timelineTop: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: "8px",
  },
  timeChip: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.03em",
  },
  stepTitle: {
    margin: 0,
    fontSize: "17px",
    fontWeight: 700,
  },
  stepSummary: {
    margin: "0 0 8px",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  stepAction: {
    margin: "0 0 12px",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  jumpButton: {
    border: "1px solid #d0e6d2",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  jumpList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  quickJump: {
    border: "1px solid #d0e6d2",
    borderRadius: "12px",
    padding: "12px 14px",
    textAlign: "left",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  quickJumpLabel: {
    fontSize: "14px",
    fontWeight: 700,
  },
  quickJumpNote: {
    fontSize: "12px",
    lineHeight: 1.4,
  },
  tipList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  tipRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
  },
  tipDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    backgroundColor: "#198754",
    marginTop: "5px",
    flexShrink: 0,
  },
  tipText: {
    fontSize: "13px",
    lineHeight: 1.5,
  },
};

export default DemoGuidePage;
