import React, { useMemo, useState } from "react";

import { useColorMode } from "../utils/useColorMode";

const demoTimeline = [
  {
    id: "dashboard",
    time: "0:00 - 0:30",
    title: "Start with the overview",
    summary: "Use the dashboard to frame Doria as one operating picture for institutional safety, coordination, and decision-making.",
    action: "Open with the mission and explain that Doria gives one command view instead of fragmented tools.",
    talkTrack:
      "This is where I frame the platform. Doria is not just a reporting tool. It is the operating layer that helps an institution see what is happening, understand what matters, and coordinate the right response quickly.",
    highlights: [
      "Unified overview of institutional activity",
      "Fast path into operational modules",
      "Clear entry point for decision-makers",
    ],
    path: "/dashboard",
    cta: "Open Dashboard",
  },
  {
    id: "institutions",
    time: "0:30 - 1:00",
    title: "Show institution onboarding",
    summary: "Demonstrate where a new organization is created and managed inside the platform.",
    action: "Explain that every rollout starts by defining the institution, ownership, and the operating structure.",
    talkTrack:
      "Before operations begin, the institution has to exist in a clear and manageable way. This page is where the organization gets onboarded, structured, and prepared for collaboration across teams.",
    highlights: [
      "Institution creation and ownership",
      "Membership and structure",
      "Foundation for every other workflow",
    ],
    path: "/institutions",
    cta: "Open Institutions",
  },
  {
    id: "public-report",
    time: "1:00 - 1:25",
    title: "Show public incident reporting",
    summary: "Use the public report page to show how a citizen or field reporter can submit an incident without logging in.",
    action: "This is the public intake side of Doria, where typed details, photos, and location hints can be routed into the operational system.",
    talkTrack:
      "Doria is not only for internal users. A member of the public or a field-based reporter can submit an incident directly, and the platform uses context and AI-assisted routing to connect that report to the right institution or facility.",
    highlights: [
      "No-login reporting workflow",
      "Image, text, and location-based incident submission",
      "Direct path from public report into institutional operations",
    ],
    path: "/report-incident",
    cta: "Open Public Report Page",
  },
  {
    id: "incident-status",
    time: "1:25 - 1:45",
    title: "Show OB-number status lookup",
    summary: "Use the incident status page to show how a public user can request an update using an OB number or reference.",
    action: "This adds transparency and follow-up visibility for the reporter without requiring account access.",
    talkTrack:
      "After a report is filed, the user should not disappear into a black box. This page lets them use an OB number or public reference together with their contact details to request a status update and see what is happening.",
    highlights: [
      "OB number or reference-based status lookup",
      "Public-facing update request flow",
      "More trust and visibility after incident submission",
    ],
    path: "/incident-status",
    cta: "Open Incident Status Page",
  },
  {
    id: "facilities",
    time: "1:45 - 2:15",
    title: "Show facilities and coverage",
    summary: "Move to facilities and the facility map to show operational locations and geographic reach.",
    action: "This step bridges setup and operations by tying the institution to physical places and service coverage.",
    talkTrack:
      "Now we move from the organization itself to the places it serves. Facilities make the platform operationally meaningful because incidents, coverage, and response all become location-aware.",
    highlights: [
      "Facility registry for operational sites",
      "Map view for geographic context",
      "Location-aware safety workflows",
    ],
    path: "/facilities",
    cta: "Open Facilities",
    secondaryPath: "/facilities/map",
    secondaryCta: "Open Facility Map",
  },
  {
    id: "services",
    time: "2:15 - 2:45",
    title: "Show response teams",
    summary: "Use emergency services to show who responds when incidents happen.",
    action: "Talk about response readiness, service coverage, and how institutions coordinate the right responders.",
    talkTrack:
      "A platform is only useful if action can follow information. This screen shows the service layer, the people and teams that actually respond when an issue is escalated.",
    highlights: [
      "Response network visibility",
      "Service readiness and coordination",
      "Faster matching of incidents to responders",
    ],
    path: "/emergency-services",
    cta: "Open Emergency Services",
  },
  {
    id: "coordination",
    time: "2:45 - 3:10",
    title: "Show live coordination",
    summary: "Use the call center board to show the communication and coordination layer.",
    action: "Explain how updates, escalations, and shared awareness happen in one operational workspace.",
    talkTrack:
      "Once a situation starts evolving, coordination becomes just as important as the original report. This is where teams stay aligned, exchange updates, and keep the response moving.",
    highlights: [
      "Shared command-and-control workspace",
      "Better handoffs across teams",
      "Reduced communication fragmentation",
    ],
    path: "/chat",
    cta: "Open Call Center Board",
  },
  {
    id: "incidents",
    time: "3:10 - 4:00",
    title: "Show incident handling",
    summary: "Move into incidents and incident manager for live capture, triage, assignment, and tracking.",
    action: "If you spend extra time on one operational step, this is the strongest one because it shows the core response workflow.",
    talkTrack:
      "This is the heart of the operational story. An incident can be captured, classified, assigned, tracked, and followed up in a structured way. That is how we move from awareness to accountable action.",
    highlights: [
      "Structured incident capture",
      "Triage, assignment, and follow-up",
      "Operational accountability over time",
    ],
    path: "/incidents",
    cta: "Open Incidents",
    secondaryPath: "/incidents/manage",
    secondaryCta: "Open Incident Manager",
  },
  {
    id: "intelligence",
    time: "4:00 - 4:40",
    title: "Show intelligence and analysis",
    summary: "Use AI insights and area intelligence to show proactive planning, pattern detection, and decision support.",
    action: "Frame this as the moment where operations data becomes strategy, foresight, and prevention.",
    talkTrack:
      "Doria does not stop at recording incidents. It helps institutions see patterns, identify risk, and make better decisions earlier. This is where the platform becomes proactive rather than purely reactive.",
    highlights: [
      "AI-assisted insight generation",
      "Pattern detection and area awareness",
      "Support for proactive planning",
    ],
    path: "/ai/insights",
    cta: "Open AI Insights",
    secondaryPath: "/incidents/area-intelligence",
    secondaryCta: "Open Area Intelligence",
  },
  {
    id: "vip",
    time: "4:40 - 4:55",
    title: "Show VIP surveillance",
    summary: "Use VIP surveillance to show that Doria can support higher-sensitivity protection and monitoring workflows.",
    action: "This helps position the platform beyond general incident handling into specialized operational protection use cases.",
    talkTrack:
      "This screen shows that Doria can also support high-priority protection scenarios. It extends the platform from general safety operations into more specialized monitoring and coordination workflows.",
    highlights: [
      "Support for higher-sensitivity workflows",
      "Specialized operational monitoring",
      "Broader institutional security use cases",
    ],
    path: "/incidents/vip-surveillance",
    cta: "Open VIP Surveillance",
  },
  {
    id: "security-control",
    time: "4:55 - 5:10",
    title: "Show security control",
    summary: "Use Security Control to demonstrate administrative security oversight and blocked-access management.",
    action: "This helps show that Doria includes governance and platform protection, not just frontline operations.",
    talkTrack:
      "Operational platforms also need security administration. This screen shows that Doria gives administrators visibility and control over access risks and protective actions inside the platform.",
    highlights: [
      "Administrative security oversight",
      "Blocked access and control workflows",
      "Operational trust and platform governance",
    ],
    path: "/admin/security",
    cta: "Open Security Control",
  },
  {
    id: "ai-console",
    time: "5:10 - 5:20",
    title: "Show AI console",
    summary: "Use the AI Console to demonstrate the administrative AI workspace available to privileged users.",
    action: "Position this as the platform’s advanced AI operating area for superusers and administrators.",
    talkTrack:
      "Beyond end-user insights, Doria also provides an AI administration layer. This is useful when you want to show that AI capabilities can be governed, supervised, and used in a more advanced operational way.",
    highlights: [
      "Advanced AI administration workspace",
      "Superuser-level AI access",
      "Controlled expansion of AI operations",
    ],
    path: "/admin/ai-console",
    cta: "Open AI Console",
  },
  {
    id: "integration",
    time: "5:20 - 5:35",
    title: "Show integrations",
    summary: "Use the API platform to show how Doria connects to existing systems instead of forcing a full replacement.",
    action: "Use this to reassure technical and institutional stakeholders that adoption can be incremental.",
    talkTrack:
      "Institutions rarely want to throw away every existing tool. The API layer lets Doria plug into what is already there, which makes rollout more realistic and much easier to adopt.",
    highlights: [
      "Integration with existing systems",
      "Lower adoption friction",
      "Expandable platform architecture",
    ],
    path: "/api-platform",
    cta: "Open API Platform",
  },
  {
    id: "close",
    time: "5:35 - 5:45",
    title: "Close on adoption and scale",
    summary: "Use billing or settings to show that the platform is governable, configurable, and ready for institutional rollout.",
    action: "End with confidence: this is not just a prototype workflow, it is a platform that can be run, managed, and scaled.",
    talkTrack:
      "I close by showing that Doria is not just useful in a demo. It is governable, configurable, and structured for real institutional adoption over time.",
    highlights: [
      "Operational sustainability",
      "Administrative control and governance",
      "Readiness for growth and rollout",
    ],
    path: "/billing",
    cta: "Open Billing",
    secondaryPath: "/settings",
    secondaryCta: "Open Settings",
  },
];

const featuredGroups = [
  {
    label: "Public Access",
    items: [
      { label: "Report Incident", note: "Public incident submission without login.", path: "/report-incident" },
      { label: "Incident Status", note: "Check incident updates using OB number or reference.", path: "/incident-status" },
    ],
  },
  {
    label: "Core",
    items: [
      { label: "5-Min Site Tour", note: "Presenter guide and embedded walkthrough.", path: "/demo-guide" },
      { label: "Dashboard", note: "Platform overview and entry point.", path: "/dashboard" },
      { label: "AI Insights", note: "AI-driven analysis and summaries.", path: "/ai/insights" },
      { label: "API Platform", note: "Integration and ecosystem connectivity.", path: "/api-platform" },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Institutions", note: "Organization onboarding and structure.", path: "/institutions" },
      { label: "Facilities", note: "Operational sites and locations.", path: "/facilities" },
      { label: "Facility Map", note: "Geographic context and coverage.", path: "/facilities/map" },
      { label: "Emergency Services", note: "Responder network and readiness.", path: "/emergency-services" },
      { label: "Call Center Board", note: "Live coordination and communication.", path: "/chat" },
      { label: "Incidents", note: "Incident records and tracking.", path: "/incidents" },
      { label: "Incident Manager", note: "Triage, assignment, and follow-up.", path: "/incidents/manage" },
      { label: "Area Intelligence", note: "Location-based trends and analysis.", path: "/incidents/area-intelligence" },
      { label: "VIP Surveillance", note: "Specialized protection monitoring.", path: "/incidents/vip-surveillance" },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Admin Users", note: "User administration and access control.", path: "/admin/users" },
      { label: "Security Control", note: "Security and blocked-IP management.", path: "/admin/security" },
      { label: "Billing Admin", note: "Administrative billing oversight.", path: "/admin/billing" },
      { label: "AI Console", note: "Superuser AI administration workspace.", path: "/admin/ai-console" },
    ],
  },
];

const buildPreviewSrc = (path) => `${path}${path.includes("?") ? "&" : "?"}demoPreview=1`;

const DemoGuidePage = () => {
  const { theme, isDark } = useColorMode();
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const activeStep = demoTimeline[activeStepIndex];
  const hasPrevious = activeStepIndex > 0;
  const hasNext = activeStepIndex < demoTimeline.length - 1;

  const currentPreviewPath = activeStep.secondaryPath || activeStep.path;
  const currentPreviewLabel = activeStep.secondaryPath ? activeStep.secondaryCta : activeStep.cta;

  const progressLabel = useMemo(
    () => `Step ${activeStepIndex + 1} of ${demoTimeline.length}`,
    [activeStepIndex]
  );

  const openPath = (path) => {
    window.location.href = path;
  };

  const goToStep = (index) => {
    setActiveStepIndex(index);
  };

  const moveStep = (direction) => {
    setActiveStepIndex((current) => {
      const next = current + direction;
      if (next < 0 || next >= demoTimeline.length) {
        return current;
      }
      return next;
    });
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
          <h1 style={{ ...styles.heroTitle, color: theme.text }}>5-minute Doria site tour</h1>
          <p style={{ ...styles.heroText, color: theme.mutedText }}>
            This page is now built to let you present from one place: explanation on the left, a large live preview on
            the right, and a guided flow underneath so you do not need to keep opening different screens.
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
            <div style={styles.sectionHeader}>
              <h2 style={{ ...styles.sectionTitle, color: theme.text }}>Current step</h2>
              <span style={{ ...styles.sectionMeta, color: theme.mutedText }}>{progressLabel}</span>
            </div>

            <div
              style={{
                ...styles.activeStepCard,
                backgroundColor: isDark ? "#0f172a" : "#f6fff7",
                borderColor: theme.cardBorder,
              }}
            >
              <div style={styles.presenterGrid}>
                <div style={styles.presenterCopy}>
                  <div style={styles.timelineTop}>
                    <span style={styles.timeChip}>{activeStep.time}</span>
                    <h3 style={{ ...styles.stepTitle, color: theme.text }}>{activeStep.title}</h3>
                  </div>

                  <p style={{ ...styles.stepSummary, color: theme.text }}>{activeStep.summary}</p>
                  <p style={{ ...styles.stepAction, color: theme.mutedText }}>{activeStep.action}</p>

                  <div style={styles.notesBlock}>
                    <h4 style={{ ...styles.subTitle, color: theme.text }}>Talk track</h4>
                    <p style={{ ...styles.noteText, color: theme.mutedText }}>{activeStep.talkTrack}</p>
                  </div>

                  <div style={styles.notesBlock}>
                    <h4 style={{ ...styles.subTitle, color: theme.text }}>Audience should notice</h4>
                    <div style={styles.highlightList}>
                      {activeStep.highlights.map((item) => (
                        <div key={item} style={styles.highlightRow}>
                          <span style={styles.highlightDot} />
                          <span style={{ ...styles.highlightText, color: theme.mutedText }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={styles.actionRow}>
                    <button
                      type="button"
                      style={{
                        ...styles.secondaryButton,
                        backgroundColor: isDark ? "#111827" : "#ffffff",
                        borderColor: theme.cardBorder,
                        color: hasPrevious ? theme.text : theme.mutedText,
                        opacity: hasPrevious ? 1 : 0.6,
                        cursor: hasPrevious ? "pointer" : "not-allowed",
                      }}
                      onClick={() => moveStep(-1)}
                      disabled={!hasPrevious}
                    >
                      Previous step
                    </button>
                    <button
                      type="button"
                      style={{
                        ...styles.secondaryButton,
                        backgroundColor: isDark ? "#111827" : "#ffffff",
                        borderColor: theme.cardBorder,
                        color: hasNext ? theme.text : theme.mutedText,
                        opacity: hasNext ? 1 : 0.6,
                        cursor: hasNext ? "pointer" : "not-allowed",
                      }}
                      onClick={() => moveStep(1)}
                      disabled={!hasNext}
                    >
                      Next step
                    </button>
                    {activeStep.path ? (
                      <button
                        type="button"
                        style={{
                          ...styles.primaryButton,
                          backgroundColor: isDark ? "#166534" : "#0f5132",
                          color: "#ffffff",
                        }}
                        onClick={() => openPath(activeStep.path)}
                      >
                        {activeStep.cta}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div style={styles.presenterPreviewColumn}>
                  <div style={styles.previewHeader}>
                    <h4 style={{ ...styles.subTitle, color: theme.text }}>Large live preview</h4>
                    <span style={{ ...styles.previewCaption, color: theme.mutedText }}>{currentPreviewLabel}</span>
                  </div>
                  <div style={styles.activePreviewFrame}>
                    {currentPreviewPath ? (
                      <iframe
                        title={`${activeStep.title} preview`}
                        src={buildPreviewSrc(currentPreviewPath)}
                        loading="lazy"
                        style={styles.activePreviewIframe}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section style={{ ...styles.card, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
            <div style={styles.sectionHeader}>
              <h2 style={{ ...styles.sectionTitle, color: theme.text }}>Full demo flow</h2>
              <span style={{ ...styles.sectionMeta, color: theme.mutedText }}>
                Click any step to switch the large preview
              </span>
            </div>
            <div style={styles.timeline}>
              {demoTimeline.map((step, index) => {
                const isActive = index === activeStepIndex;
                return (
                  <article
                    key={step.id}
                    style={{
                      ...styles.timelineCard,
                      borderColor: isActive ? "#198754" : theme.cardBorder,
                      backgroundColor: isActive ? (isDark ? "#0f172a" : "#f0fdf4") : "transparent",
                    }}
                  >
                    <div style={styles.timelineTop}>
                      <span style={styles.timeChip}>{step.time}</span>
                      <h3 style={{ ...styles.stepTitle, color: theme.text }}>{step.title}</h3>
                    </div>
                    <p style={{ ...styles.stepSummary, color: theme.text }}>{step.summary}</p>
                    <p style={{ ...styles.stepAction, color: theme.mutedText }}>{step.action}</p>
                    <div style={styles.actionRow}>
                      <button
                        type="button"
                        style={{
                          ...styles.secondaryButton,
                          backgroundColor: isDark ? "#111827" : "#ffffff",
                          borderColor: theme.cardBorder,
                          color: theme.text,
                        }}
                        onClick={() => goToStep(index)}
                      >
                        Show this step
                      </button>
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
                      {step.secondaryPath ? (
                        <button
                          type="button"
                          style={{
                            ...styles.jumpButton,
                            backgroundColor: isDark ? "#0f172a" : "#f0fdf4",
                            borderColor: theme.cardBorder,
                            color: theme.text,
                          }}
                          onClick={() => openPath(step.secondaryPath)}
                        >
                          {step.secondaryCta}
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section style={{ ...styles.card, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}>
            <div style={styles.sectionHeader}>
              <h2 style={{ ...styles.sectionTitle, color: theme.text }}>Sidebar feature coverage</h2>
              <span style={{ ...styles.sectionMeta, color: theme.mutedText }}>
                Every feature from Core, Operations, and Admin is represented here
              </span>
            </div>
            <div style={styles.coverageGrid}>
              {featuredGroups.map((group) => (
                <div
                  key={group.label}
                  style={{
                    ...styles.coverageCard,
                    backgroundColor: isDark ? "#0f172a" : "#f8faf8",
                    borderColor: theme.cardBorder,
                  }}
                >
                  <h3 style={{ ...styles.coverageTitle, color: theme.text }}>{group.label}</h3>
                  <div style={styles.coverageList}>
                    {group.items.map((item) => (
                      <div key={`${group.label}-${item.label}`} style={styles.coverageRow}>
                        <span style={styles.coverageDot} />
                        <div style={styles.coverageTextWrap}>
                          <span style={{ ...styles.coverageItemLabel, color: theme.text }}>{item.label}</span>
                          <span style={{ ...styles.coverageItemNote, color: theme.mutedText }}>{item.note}</span>
                        </div>
                        {item.path ? (
                          <button
                            type="button"
                            style={{
                              ...styles.coverageButton,
                              backgroundColor: isDark ? "#111827" : "#ffffff",
                              borderColor: theme.cardBorder,
                              color: theme.text,
                            }}
                            onClick={() => openPath(item.path)}
                          >
                            Preview
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
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
    width: "100%",
    maxWidth: "1680px",
    margin: "0 auto",
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
    maxWidth: "980px",
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
    display: "block",
  },
  mainColumn: {
    minWidth: 0,
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
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "14px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 700,
  },
  sectionMeta: {
    fontSize: "12px",
    fontWeight: 600,
  },
  activeStepCard: {
    border: "1px solid #d0e6d2",
    borderRadius: "16px",
    padding: "16px",
  },
  presenterGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(320px, 0.72fr) minmax(920px, 1.88fr)",
    gap: "20px",
    alignItems: "start",
  },
  presenterCopy: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: 0,
  },
  presenterPreviewColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    minWidth: 0,
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
    margin: "0 0 4px",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  stepAction: {
    margin: "0 0 8px",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  notesBlock: {
    border: "1px solid rgba(148, 163, 184, 0.18)",
    borderRadius: "12px",
    padding: "12px",
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  subTitle: {
    margin: "0 0 8px",
    fontSize: "14px",
    fontWeight: 700,
  },
  noteText: {
    margin: 0,
    fontSize: "13px",
    lineHeight: 1.6,
  },
  highlightList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  highlightRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
  },
  highlightDot: {
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    backgroundColor: "#198754",
    marginTop: "6px",
    flexShrink: 0,
  },
  highlightText: {
    fontSize: "13px",
    lineHeight: 1.5,
  },
  actionRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  primaryButton: {
    border: "none",
    borderRadius: "10px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #d0e6d2",
    borderRadius: "10px",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  jumpButton: {
    border: "1px solid #d0e6d2",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  coverageGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "14px",
  },
  coverageCard: {
    border: "1px solid #d0e6d2",
    borderRadius: "14px",
    padding: "14px",
  },
  coverageTitle: {
    margin: "0 0 12px",
    fontSize: "16px",
    fontWeight: 700,
  },
  coverageList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  coverageRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
  },
  coverageDot: {
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    backgroundColor: "#198754",
    marginTop: "6px",
    flexShrink: 0,
  },
  coverageTextWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    flex: 1,
  },
  coverageButton: {
    border: "1px solid #d0e6d2",
    borderRadius: "10px",
    padding: "8px 10px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
  },
  coverageItemLabel: {
    fontSize: "13px",
    fontWeight: 700,
  },
  coverageItemNote: {
    fontSize: "12px",
    lineHeight: 1.45,
  },
  previewHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  previewCaption: {
    fontSize: "12px",
    fontWeight: 600,
  },
  activePreviewFrame: {
    width: "100%",
    height: "820px",
    overflow: "hidden",
    borderRadius: "14px",
    border: "1px solid rgba(148, 163, 184, 0.25)",
    backgroundColor: "#e5e7eb",
    boxShadow: "0 10px 30px rgba(15, 81, 50, 0.08)",
  },
  activePreviewIframe: {
    width: "1440px",
    height: "1080px",
    border: 0,
    transform: "scale(0.63)",
    transformOrigin: "top left",
    pointerEvents: "auto",
  },
};

export default DemoGuidePage;
