const pptxgen = require('pptxgenjs');

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Doria Team';
pptx.company = 'Doria';
pptx.subject = 'AI Hackathon Pitch';
pptx.title = 'Doria Pitch Deck';

const COLORS = {
  dark: '0F5132',
  green: '22C55E',
  light: 'F4F5F7',
  slate: '111827',
  amber: 'F59E0B',
  white: 'FFFFFF',
};

const FONTS = {
  title: 'Poppins',
  body: 'Inter',
};

const MARGIN_X = 0.6;
const TITLE_Y = 0.5;
const BODY_Y = 1.5;
const BODY_W = 12.2;
const BODY_H = 4.5;

function addTitle(slide, text) {
  slide.addText(text, {
    x: MARGIN_X,
    y: TITLE_Y,
    w: 12.2,
    h: 0.6,
    fontFace: FONTS.title,
    fontSize: 36,
    color: COLORS.dark,
    bold: true,
  });
}

function addSubtitle(slide, text) {
  slide.addText(text, {
    x: MARGIN_X,
    y: 1.2,
    w: 12.2,
    h: 0.4,
    fontFace: FONTS.body,
    fontSize: 18,
    color: COLORS.slate,
  });
}

function addBody(slide, text) {
  slide.addText(text, {
    x: MARGIN_X,
    y: BODY_Y,
    w: BODY_W,
    h: BODY_H,
    fontFace: FONTS.body,
    fontSize: 22,
    color: COLORS.slate,
    lineSpacingMultiple: 1.2,
  });
}

function addAccent(slide) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.2,
    fill: { color: COLORS.green },
    line: { color: COLORS.green },
  });
}

function addFooter(slide, text) {
  slide.addText(text, {
    x: MARGIN_X,
    y: 6.9,
    w: 12.2,
    h: 0.3,
    fontFace: FONTS.body,
    fontSize: 12,
    color: '6B7280',
  });
}

// Slide 1: Title
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.light };
  addAccent(slide);
  addTitle(slide, 'Doria');
  addSubtitle(slide, 'AI-Powered Incident Intelligence for Government');
  slide.addText('From raw reports to decisive action in minutes', {
    x: MARGIN_X,
    y: 2.2,
    w: 12.2,
    h: 0.6,
    fontFace: FONTS.body,
    fontSize: 20,
    color: COLORS.slate,
  });
  addFooter(slide, 'AI Hackathon Pitch');
  slide.addNotes(`[Speaker Notes]\nWe built Doria to unify incident reporting across government and apply AI to deliver fast, actionable insights.`);
}

// Slide 2: Problem
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.light };
  addAccent(slide);
  addTitle(slide, 'The Problem');
  addBody(slide, '- Incidents are siloed across ministries\n- Slow triage and fragmented visibility\n- Leaders lack real-time, cross-agency intelligence');
  slide.addNotes(`[Speaker Notes]\nPolice, KWS, pipeline, and others each see fragments. Decisions are delayed because data is not connected.`);
}

// Slide 3: Solution
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.light };
  addAccent(slide);
  addTitle(slide, 'The Solution');
  addBody(slide, '- Centralized incident reporting\n- Facility context and role-based access\n- AI insights for trends, anomalies, hotspots');
  slide.addNotes(`[Speaker Notes]\nDoria consolidates incidents across agencies and applies AI to surface what matters fast.`);
}

// Slide 4: Demo Snapshot
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.light };
  addAccent(slide);
  addTitle(slide, 'Demo Snapshot');
  addBody(slide, '- Incident intake and follow-ups\n- Facility-level filtering\n- AI Insights dashboard with KPIs and trends');
  slide.addNotes(`[Speaker Notes]\nHere is the workflow: create incident, update it, and instantly get AI insights.`);
}

// Slide 5: AI Engine
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.light };
  addAccent(slide);
  addTitle(slide, 'The AI Engine');
  addBody(slide, '- Auto-summaries and risk scoring\n- Spike detection and anomaly alerts\n- Explainable drill-downs for transparency');
  slide.addNotes(`[Speaker Notes]\nAI surfaces patterns leaders might miss and shows the evidence behind each insight.`);
}

// Slide 6: Impact
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.light };
  addAccent(slide);
  addTitle(slide, 'Impact');
  addBody(slide, '- Faster response across agencies\n- Smarter resource allocation\n- Shared situational awareness');
  slide.addNotes(`[Speaker Notes]\nThis is not just a dashboard. It reduces response time and improves coordination.`);
}

// Slide 7: Differentiation
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.light };
  addAccent(slide);
  addTitle(slide, 'Why Doria Wins');
  addBody(slide, '- Built for government workflows\n- Facility-level accountability\n- Privacy-aware and auditable');
  slide.addNotes(`[Speaker Notes]\nMost tools are generic. Doria is designed for public sector needs: security, transparency, accountability.`);
}

// Slide 8: Roadmap
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.light };
  addAccent(slide);
  addTitle(slide, 'Roadmap');
  addBody(slide, '- v1: AI insights and dashboards\n- v2: Cross-agency coordination workflows\n- v3: Predictive risk alerts and geospatial modeling');
  slide.addNotes(`[Speaker Notes]\nWe start with decision support, then scale to coordination and prediction.`);
}

// Slide 9: Ask
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.light };
  addAccent(slide);
  addTitle(slide, 'The Ask');
  addBody(slide, '- Pilot with 2 to 3 ministries\n- Integrate live incident feeds\n- Co-design national standards');
  slide.addNotes(`[Speaker Notes]\nWe are ready for a pilot and real-world validation.`);
}

pptx.writeFile({ fileName: 'Doria_AI_Hackathon_Pitch.pptx' });
