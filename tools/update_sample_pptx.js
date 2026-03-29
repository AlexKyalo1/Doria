const path = require("path");
const PptxGenJS = require(path.join(__dirname, "..", "client", "node_modules", "pptxgenjs"));

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "OpenAI Codex";
pptx.company = "Doria";
pptx.subject = "Doria Stage 3 Pitch";
pptx.title = "Doria Stage 3 Pitch";
pptx.lang = "en-KE";

const OUTPUT = path.join(__dirname, "..", "artifacts", "sample_v2.pptx");

const COLORS = {
  green: "0F5132",
  greenLight: "DCFCE7",
  greenSoft: "ECFDF5",
  navy: "0F172A",
  slate: "334155",
  muted: "64748B",
  line: "D1D5DB",
  white: "FFFFFF",
  amber: "D97706",
  redSoft: "FEE2E2",
  blueSoft: "DBEAFE",
};

const FONTS = {
  title: "Poppins",
  body: "Aptos",
};

function baseSlide(slide) {
  slide.background = { color: COLORS.white };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.18,
    line: { color: COLORS.green, transparency: 100 },
    fill: { color: COLORS.green },
  });
}

function addHeader(slide, kicker, title, subtitle) {
  slide.addText(kicker, {
    x: 0.7,
    y: 0.35,
    w: 2.5,
    h: 0.25,
    fontFace: FONTS.body,
    fontSize: 11,
    bold: true,
    color: COLORS.green,
    charSpace: 1.2,
  });
  slide.addText(title, {
    x: 0.7,
    y: 0.6,
    w: 11.8,
    h: 0.6,
    fontFace: FONTS.title,
    fontSize: 26,
    bold: true,
    color: COLORS.navy,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.7,
      y: 1.15,
      w: 11.8,
      h: 0.45,
      fontFace: FONTS.body,
      fontSize: 14,
      color: COLORS.slate,
    });
  }
}

function addBullets(slide, bullets, opts = {}) {
  const runs = [];
  bullets.forEach((text) => {
    runs.push({
      text,
      options: {
        bullet: { indent: 14 },
        breakLine: true,
      },
    });
  });
  slide.addText(runs, {
    x: opts.x ?? 0.85,
    y: opts.y ?? 1.8,
    w: opts.w ?? 5.7,
    h: opts.h ?? 3.9,
    fontFace: FONTS.body,
    fontSize: opts.fontSize ?? 19,
    color: COLORS.navy,
    paraSpaceAfterPt: 11,
    breakLine: false,
    valign: "top",
  });
}

function addQuoteBox(slide, title, text, x, y, w, h, fill = COLORS.greenSoft) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    line: { color: COLORS.line, pt: 1 },
    fill: { color: fill },
  });
  slide.addText(title, {
    x: x + 0.18,
    y: y + 0.12,
    w: w - 0.36,
    h: 0.25,
    fontFace: FONTS.body,
    fontSize: 12,
    bold: true,
    color: COLORS.green,
  });
  slide.addText(text, {
    x: x + 0.18,
    y: y + 0.4,
    w: w - 0.36,
    h: h - 0.5,
    fontFace: FONTS.body,
    fontSize: 14,
    color: COLORS.slate,
    valign: "mid",
  });
}

function addMetricCard(slide, value, label, note, x, y, w, h, fill = COLORS.white) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.06,
    line: { color: COLORS.line, pt: 1 },
    fill: { color: fill },
  });
  slide.addText(value, {
    x: x + 0.12,
    y: y + 0.12,
    w: w - 0.24,
    h: 0.36,
    fontFace: FONTS.title,
    fontSize: 20,
    bold: true,
    color: COLORS.green,
    align: "center",
  });
  slide.addText(label, {
    x: x + 0.12,
    y: y + 0.52,
    w: w - 0.24,
    h: 0.24,
    fontFace: FONTS.body,
    fontSize: 11,
    bold: true,
    color: COLORS.navy,
    align: "center",
  });
  slide.addText(note, {
    x: x + 0.14,
    y: y + 0.8,
    w: w - 0.28,
    h: h - 0.88,
    fontFace: FONTS.body,
    fontSize: 9.5,
    color: COLORS.muted,
    align: "center",
    valign: "mid",
  });
}

function addFooter(slide, label) {
  slide.addText(label, {
    x: 0.7,
    y: 7.0,
    w: 8,
    h: 0.2,
    fontFace: FONTS.body,
    fontSize: 10,
    color: COLORS.muted,
  });
}

function addCenterTitle(slide, title, subtitle) {
  slide.addText(title, {
    x: 0.9,
    y: 1.35,
    w: 11.5,
    h: 0.9,
    align: "center",
    fontFace: FONTS.title,
    fontSize: 28,
    bold: true,
    color: COLORS.white,
  });
  slide.addText(subtitle, {
    x: 1.4,
    y: 2.35,
    w: 10.5,
    h: 0.8,
    align: "center",
    fontFace: FONTS.body,
    fontSize: 16,
    color: COLORS.greenLight,
  });
}

function addDiagramBox(slide, text, x, y, w, h, fill, line = COLORS.line) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.06,
    line: { color: line, pt: 1.2 },
    fill: { color: fill },
  });
  slide.addText(text, {
    x: x + 0.08,
    y: y + 0.08,
    w: w - 0.16,
    h: h - 0.16,
    align: "center",
    valign: "mid",
    fontFace: FONTS.body,
    fontSize: 12,
    bold: true,
    color: COLORS.navy,
  });
}

function addArrow(slide, text, x, y, w) {
  slide.addText(text, {
    x,
    y,
    w,
    h: 0.25,
    align: "center",
    fontFace: FONTS.body,
    fontSize: 16,
    bold: true,
    color: COLORS.green,
  });
}

{
  const slide = pptx.addSlide();
  slide.background = {
    color: COLORS.green,
  };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 7.5,
    line: { color: COLORS.green, transparency: 100 },
    fill: {
      color: COLORS.green,
      transparency: 0,
    },
  });
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 1.0,
    y: 0.9,
    w: 11.3,
    h: 5.2,
    rectRadius: 0.08,
    line: { color: "2FA36B", pt: 1.2 },
    fill: { color: "166534" },
  });
  slide.addText("DORIA", {
    x: 5.3,
    y: 0.95,
    w: 2.7,
    h: 0.45,
    align: "center",
    fontFace: FONTS.body,
    fontSize: 13,
    bold: true,
    color: COLORS.greenLight,
    charSpace: 2.2,
  });
  addCenterTitle(
    slide,
    "Doria Stage 3 Pitch",
    "AI-powered incident intelligence for coordinated, data-driven response across institutions"
  );
  slide.addText("Aligned to Doria_Stage3_Pitch_Timed", {
    x: 3.65,
    y: 3.45,
    w: 6.0,
    h: 0.35,
    align: "center",
    fontFace: FONTS.body,
    fontSize: 13,
    color: COLORS.white,
    bold: true,
  });
  addQuoteBox(
    slide,
    "Core promise",
    "Transform fragmented incident reporting into coordinated operational intelligence.",
    2.2,
    4.15,
    8.9,
    1.0,
    "14532D"
  );
  slide.addText("Alex Kyalo | Founder | Pilot-ready platform", {
    x: 3.35,
    y: 6.45,
    w: 6.7,
    h: 0.25,
    align: "center",
    fontFace: FONTS.body,
    fontSize: 11,
    color: COLORS.greenLight,
  });
}

const slides = [
  {
    kicker: "0:00-1:00",
    title: "Introduction + National Vision",
    subtitle: "Doria is an AI-powered incident intelligence platform for coordinated, data-driven response.",
    bullets: [
      "Doria helps government institutions move from fragmented incident reporting to coordinated, data-driven response.",
      "The vision is a Kenya where institutions can detect, understand, and respond in real time through one unified operational intelligence layer.",
      "Doria is not just digitizing reports; it is building intelligent incident coordination infrastructure for the nation.",
    ],
    note:
      "Good afternoon distinguished judges. I am Alex Kyalo, founder of Doria. Today I present an AI-powered incident intelligence platform that helps institutions move from fragmented reporting to coordinated response.",
  },
  {
    kicker: "1:00-3:00",
    title: "National Security Context / Strategic Gap",
    subtitle: "Incident information is still fragmented across institutions, facilities, and teams.",
    bullets: [
      "This fragmentation creates slow response, limited cross-agency visibility, and weak awareness of hotspots and repeat threats.",
      "Incidents are often logged in isolated systems and followed up manually, so decision-makers see only fragments of the operational picture.",
      "In a national security environment, fragmented incident response becomes a resilience gap.",
    ],
    note:
      "A facility may detect a threat, a field team may log an update, and another institution may also be affected. Without shared intelligence, response becomes delayed and reactive.",
  },
  {
    kicker: "3:00-4:30",
    title: "Cross-Sectoral Resilience",
    subtitle: "Doria strengthens multiple sectors at the same time.",
    bullets: [
      "In public safety, it improves incident capture and follow-up.",
      "In energy, utilities, transport, logistics, and administration, it improves visibility around threats, disruptions, and accountable workflows.",
      "Instead of isolated operations, Doria creates a shared intelligence workflow built around facilities, incidents, and actionable AI insights.",
    ],
    note:
      "This is cross-sector resilience by design, because one operational intelligence layer can support multiple institutional contexts.",
  },
  {
    kicker: "4:30-6:00",
    title: "National Sovereignty & Control",
    subtitle: "The platform is built with sovereignty and institutional control in mind.",
    bullets: [
      "Operational data can remain under government-controlled infrastructure.",
      "The platform supports controlled deployment for sensitive environments.",
      "Its architecture is modular, maintainable, and designed for local ownership of data, workflows, and long-term evolution.",
    ],
    note:
      "This allows institutions to retain control over their data, workflows, and long-term operational evolution.",
  },
  {
    kicker: "6:00-9:00",
    title: "Demo",
    subtitle: "A real operational scenario from incident capture to intelligence.",
    bullets: [
      "An incident is reported with incident type, geolocation, institution context, and follow-up ownership.",
      "Doria applies AI to the operational dataset and returns a summary, risk level, top patterns, facility hotspots, follow-up gaps, and priority actions.",
      "A decision-maker can also select a geographic area and instantly analyze facilities and incidents inside that corridor.",
    ],
    note:
      "Every update is tied to ownership. Every follow-up is traceable. Every insight is structured for review.",
  },
  {
    kicker: "9:00-11:00",
    title: "Scalability & Speed to Impact",
    subtitle: "Doria is built to scale in stages and integrate into existing workflows.",
    bullets: [
      "Phase 1 is pilot deployment with incident capture, follow-up workflows, and AI summaries in selected institutions or counties.",
      "Phase 2 expands facility coverage and cross-agency visibility.",
      "Phase 3 enables broader national coordination, stronger geospatial intelligence, and predictive operational alerts.",
    ],
    note:
      "To scale, Doria integrates into existing workflows rather than forcing institutions to replace everything at once.",
  },
  {
    kicker: "11:00-12:30",
    title: "Trust, Ethics & Governance",
    subtitle: "Trust, accountability, and governance are built into the platform.",
    bullets: [
      "Doria includes role-based access control, scoped visibility, audit trails, and structured operational ownership.",
      "Its AI outputs are designed to be understandable and reviewable, not black-box decisions.",
      "The system is privacy-aware and built for institutional accountability.",
    ],
    note:
      "In public operations, intelligence must be fast, secure, auditable, and governable.",
  },
  {
    kicker: "12:30-13:30",
    title: "Economic & Operational ROI",
    subtitle: "Operationally, Doria reduces the cost of fragmented response.",
    bullets: [
      "It shortens the time spent reconciling scattered reports.",
      "It improves allocation of attention and resources and helps institutions identify hotspots earlier.",
      "It increases accountability through visible follow-up ownership and traceable action history.",
    ],
    note:
      "The cost of inaction is delay, duplication, and weak coordination. The benefit of Doria is faster triage, stronger visibility, and better institutional response.",
  },
  {
    kicker: "13:30-14:30",
    title: "The X-Factor",
    subtitle: "Doria combines operations, governance, and AI in one workflow.",
    bullets: [
      "This is not just a reporting tool; it combines operations, governance, and AI in one workflow.",
      "It has been taken from concept to a working, pilot-ready platform by a solo founder.",
      "The country does not only need more digital records. It needs actionable operational intelligence.",
    ],
    note:
      "What makes Doria different is the way it ties operational workflows to explainable intelligence and institutional accountability.",
  },
  {
    kicker: "14:30-15:00",
    title: "Closing / Call to Action",
    subtitle: "Doria transforms fragmented incident reporting into coordinated incident intelligence.",
    bullets: [
      "It improves visibility, strengthens accountability, and supports faster and smarter response across institutions.",
      "The platform is pilot-ready, the AI layer is real, and the national need is urgent.",
      "The next step is the opportunity to pilot Doria with public institutions and validate it in live operational environments.",
    ],
    note:
      "Thank you.",
  },
];

slides.forEach((item, index) => {
  const slide = pptx.addSlide();
  baseSlide(slide);
  addHeader(slide, item.kicker, item.title, item.subtitle);
  addBullets(slide, item.bullets);
  addQuoteBox(
    slide,
    "Speaker cue",
    item.note,
    7.0,
    1.95,
    5.4,
    2.25,
    index % 2 === 0 ? COLORS.greenSoft : COLORS.blueSoft
  );
  addQuoteBox(
    slide,
    "Why it matters",
    item.bullets[0],
    7.0,
    4.45,
    5.4,
    1.35,
    COLORS.white
  );

  if (index === 5) {
    addMetricCard(slide, "Minutes", "From report to insight", "Designed to turn raw incident data into structured intelligence fast.", 7.0, 5.95, 1.7, 0.82, COLORS.greenSoft);
    addMetricCard(slide, "3 layers", "Operational context", "Incident, facility, and institution context are combined in one workflow.", 8.95, 5.95, 1.7, 0.82, COLORS.blueSoft);
    addMetricCard(slide, "5 outputs", "AI response set", "Summary, risk, patterns, hotspots, and recommended actions.", 10.9, 5.95, 1.5, 0.82, "FEF3C7");
  }

  if (index === 7) {
    addMetricCard(slide, "3 phases", "Scale pathway", "Pilot, expand, then coordinate nationally.", 7.0, 5.95, 1.7, 0.82, COLORS.greenSoft);
    addMetricCard(slide, "Low disruption", "Adoption model", "Integrates into existing workflows rather than replacing everything.", 8.95, 5.95, 1.95, 0.82, COLORS.blueSoft);
    addMetricCard(slide, "Faster impact", "Implementation goal", "Controlled rollout with visible operational value early.", 11.15, 5.95, 1.25, 0.82, "FEF3C7");
  }

  addFooter(slide, "Doria Stage 3 Pitch");
});

{
  const slide = pptx.addSlide();
  baseSlide(slide);
  addHeader(slide, "METRICS", "Operational metrics that matter", "Illustrative performance and rollout metrics for presenting Doria's value.");

  addMetricCard(slide, "1 platform", "Unified operating layer", "One shared workspace for incidents, facilities, AI insights, and response coordination.", 0.95, 1.95, 2.2, 1.25, COLORS.greenSoft);
  addMetricCard(slide, "3 sectors+", "Cross-sector relevance", "Public safety, administration, transport, utilities, and other resilience-focused environments.", 3.35, 1.95, 2.2, 1.25, COLORS.blueSoft);
  addMetricCard(slide, "5 core outputs", "AI insight pack", "Summary, risk level, top patterns, facility hotspots, and priority actions.", 5.75, 1.95, 2.2, 1.25, "FEF3C7");
  addMetricCard(slide, "Role-based", "Governance model", "Scoped visibility, ownership, and reviewable operational actions.", 8.15, 1.95, 2.2, 1.25, COLORS.white);
  addMetricCard(slide, "Pilot-ready", "Deployment status", "A working platform ready for live institutional validation.", 10.55, 1.95, 1.8, 1.25, COLORS.greenSoft);

  addQuoteBox(slide, "Suggested speaking line", "The strongest metrics for Doria are operational rather than vanity metrics: how fast a team can move from report to insight, how clearly ownership is assigned, and how quickly institutions can coordinate response.", 0.95, 3.6, 11.4, 1.0, COLORS.white);

  addMetricCard(slide, "< 1 workflow gap", "Fragmentation reduced", "Doria is designed to collapse multiple disconnected steps into one operational path.", 1.2, 4.95, 2.35, 1.2, COLORS.white);
  addMetricCard(slide, "1 -> many", "Institution scaling", "One institution can manage multiple facilities, incidents, and response threads in one place.", 3.85, 4.95, 2.15, 1.2, COLORS.greenSoft);
  addMetricCard(slide, "End-to-end", "Traceability", "Every update, follow-up, comment, and action is tied back to the operational record.", 6.3, 4.95, 2.15, 1.2, COLORS.blueSoft);
  addMetricCard(slide, "3-phase", "Scale roadmap", "Pilot deployment, expanded coverage, then broader coordination and predictive intelligence.", 8.75, 4.95, 2.15, 1.2, "FEF3C7");
  addMetricCard(slide, "Public -> admin", "Workflow continuity", "Supports the path from public report or field report to governed administrative action.", 11.2, 4.95, 1.15, 1.2, COLORS.white);

  addFooter(slide, "Doria Stage 3 Pitch | Metrics");
}

{
  const slide = pptx.addSlide();
  baseSlide(slide);
  addHeader(slide, "ERD", "Doria core data model", "A simplified entity relationship view of the platform.");

  addDiagramBox(slide, "User", 0.9, 2.05, 1.35, 0.7, COLORS.greenSoft, COLORS.green);
  addDiagramBox(slide, "Institution", 2.75, 2.05, 1.65, 0.7, COLORS.blueSoft, COLORS.green);
  addDiagramBox(slide, "Facility", 4.9, 2.05, 1.45, 0.7, "F3E8FF", "8B5CF6");
  addDiagramBox(slide, "Incident", 6.85, 2.05, 1.45, 0.7, "FEF3C7", COLORS.amber);
  addDiagramBox(slide, "Updates", 8.85, 1.25, 1.35, 0.62, COLORS.white);
  addDiagramBox(slide, "Comments", 8.85, 2.05, 1.35, 0.62, COLORS.white);
  addDiagramBox(slide, "Activity", 8.85, 2.85, 1.35, 0.62, COLORS.white);
  addDiagramBox(slide, "Shared Access", 10.7, 2.05, 1.55, 0.62, COLORS.white);

  addArrow(slide, "1:N", 2.2, 2.2, 0.4);
  addArrow(slide, "1:N", 4.45, 2.2, 0.4);
  addArrow(slide, "1:N", 6.4, 2.2, 0.4);
  addArrow(slide, "1:N", 8.35, 1.42, 0.38);
  addArrow(slide, "1:N", 8.35, 2.2, 0.38);
  addArrow(slide, "1:N", 8.35, 3.0, 0.38);
  addArrow(slide, "share", 10.28, 2.2, 0.38);

  addDiagramBox(slide, "Institution Chat Workspace", 1.45, 4.3, 2.1, 0.7, COLORS.greenSoft, COLORS.green);
  addDiagramBox(slide, "Conversations", 4.0, 4.3, 1.8, 0.7, COLORS.white);
  addDiagramBox(slide, "Emergency Alerts", 6.25, 4.3, 1.95, 0.7, COLORS.redSoft, "DC2626");
  addDiagramBox(slide, "Billing Subscription", 8.65, 4.3, 2.0, 0.7, COLORS.white);
  addDiagramBox(slide, "Feature Usage", 11.1, 4.3, 1.45, 0.7, COLORS.white);

  addArrow(slide, "1:1", 3.58, 4.47, 0.3);
  addArrow(slide, "1:N", 5.83, 4.47, 0.3);
  addArrow(slide, "1:1", 8.28, 4.47, 0.3);
  addArrow(slide, "1:N", 10.73, 4.47, 0.3);

  addQuoteBox(
    slide,
    "Read this slide as",
    "Institution is the governance anchor. Facilities and incidents drive operations. Updates, comments, activity, chat, alerts, and billing extend the operational core.",
    1.0,
    5.55,
    11.2,
    1.05,
    COLORS.greenSoft
  );

  addFooter(slide, "Doria architecture | ERD view");
}

{
  const slide = pptx.addSlide();
  baseSlide(slide);
  addHeader(slide, "FLOW", "Doria operational flow", "How information moves from reporting to coordinated action.");

  addDiagramBox(slide, "1. Report arrives", 1.0, 2.2, 1.8, 0.95, COLORS.greenSoft, COLORS.green);
  addDiagramBox(slide, "2. Incident captured\nwith location", 3.2, 2.2, 1.9, 0.95, COLORS.blueSoft, COLORS.green);
  addDiagramBox(slide, "3. Facility and\ninstitution context", 5.55, 2.2, 2.0, 0.95, "F3E8FF", "8B5CF6");
  addDiagramBox(slide, "4. AI insights and\narea analysis", 8.0, 2.2, 1.95, 0.95, "FEF3C7", COLORS.amber);
  addDiagramBox(slide, "5. Incident manager,\nchat, follow-up", 10.4, 2.2, 1.95, 0.95, COLORS.redSoft, "DC2626");

  addArrow(slide, "->", 2.86, 2.55, 0.22);
  addArrow(slide, "->", 5.24, 2.55, 0.22);
  addArrow(slide, "->", 7.66, 2.55, 0.22);
  addArrow(slide, "->", 10.05, 2.55, 0.22);

  addQuoteBox(slide, "Input", "Public or internal incident reporting enters the platform.", 1.0, 4.1, 2.35, 1.0, COLORS.greenSoft);
  addQuoteBox(slide, "Context", "The incident is tied to facilities, institutions, ownership, and geolocation.", 3.55, 4.1, 2.75, 1.0, COLORS.blueSoft);
  addQuoteBox(slide, "Intelligence", "AI summarizes risk, patterns, hotspots, and recommended actions.", 6.5, 4.1, 2.75, 1.0, "FEF3C7");
  addQuoteBox(slide, "Action", "Teams coordinate, assign, follow up, and review accountable response.", 9.45, 4.1, 2.85, 1.0, COLORS.redSoft);

  slide.addText("report -> contextualize -> analyze -> coordinate -> act", {
    x: 1.45,
    y: 5.65,
    w: 10.4,
    h: 0.35,
    align: "center",
    fontFace: FONTS.title,
    fontSize: 18,
    color: COLORS.green,
    bold: true,
  });

  slide.addText(
    "This is the Doria operating loop: faster visibility, better ownership, and more coordinated institutional response.",
    {
      x: 1.3,
      y: 6.1,
      w: 10.8,
      h: 0.45,
      align: "center",
      fontFace: FONTS.body,
      fontSize: 13,
      color: COLORS.slate,
    }
  );

  addFooter(slide, "Doria architecture | Flow view");
}

{
  const slide = pptx.addSlide();
  baseSlide(slide);
  addHeader(slide, "CLOSING", "Pilot-ready and built for live institutional validation", "The AI layer is real. The platform is working. The next step is deployment.");
  addBullets(slide, [
    "Doria improves visibility, accountability, and speed of response across institutions.",
    "It is ready for pilot deployment with public institutions and operational environments.",
    "The opportunity now is to validate Doria in live workflows and scale the impact.",
  ], { y: 2.0, w: 6.2, h: 3.2 });
  addQuoteBox(
    slide,
    "Call to action",
    "The next step is the opportunity to pilot Doria with public institutions and validate it in live operational environments.\n\nThank you.",
    7.1,
    2.0,
    5.0,
    2.3,
    COLORS.greenSoft
  );
  addFooter(slide, "Doria Stage 3 Pitch | Closing");
}

pptx.writeFile({ fileName: OUTPUT }).then(() => {
  console.log(`Wrote ${OUTPUT}`);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
