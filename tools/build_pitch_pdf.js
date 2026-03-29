const fs = require("fs");
const path = require("path");

const sourcePath = path.join(__dirname, "..", "artifacts", "Doria_Stage3_Pitch_Timed.md");
const outputPath = path.join(__dirname, "..", "artifacts", "Doria_Stage3_Pitch_Timed.pdf");

const PAGE = { width: 612, height: 792, margin: 54 };
const COLORS = {
  green: "0F766E",
  slate: "111827",
  muted: "4B5563",
};

function escapePdfText(text) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(text, maxChars) {
  const words = text.trim().split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function parseMarkdown(markdown) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const blocks = [];
  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: "p", text: paragraph.join(" ").trim() });
    paragraph = [];
  };

  for (const line of lines) {
    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    if (line.startsWith("# ")) {
      flushParagraph();
      blocks.push({ type: "h1", text: line.slice(2).trim() });
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  return blocks;
}

function paginate(blocks) {
  const pages = [];
  let current = [];
  let y = PAGE.height - PAGE.margin;

  function ensureSpace(required) {
    if (y - required < PAGE.margin) {
      pages.push(current);
      current = [];
      y = PAGE.height - PAGE.margin;
    }
  }

  for (const block of blocks) {
    if (block.type === "h1") {
      ensureSpace(40);
      current.push({ type: "h1", text: block.text, y });
      y -= 34;
      continue;
    }

    if (block.type === "h2") {
      ensureSpace(30);
      current.push({ type: "h2", text: block.text, y });
      y -= 24;
      continue;
    }

    const wrapped = wrapText(block.text, 86);
    const required = wrapped.length * 16 + 8;
    ensureSpace(required);
    current.push({ type: "p", lines: wrapped, y });
    y -= required;
  }

  if (current.length) pages.push(current);
  return pages;
}

function contentStreamForPage(items, pageNumber, totalPages) {
  const commands = [];

  commands.push("q");
  commands.push(`${PAGE.margin} ${PAGE.height - 36} ${PAGE.width - PAGE.margin * 2} 4 re`);
  commands.push(`${hexToRgb(COLORS.green)} rg`);
  commands.push("f");
  commands.push("Q");

  for (const item of items) {
    if (item.type === "h1") {
      commands.push("BT");
      commands.push(`/F2 22 Tf`);
      commands.push(`${hexToRgb(COLORS.slate)} rg`);
      commands.push(`1 0 0 1 ${PAGE.margin} ${item.y} Tm`);
      commands.push(`(${escapePdfText(item.text)}) Tj`);
      commands.push("ET");
      continue;
    }

    if (item.type === "h2") {
      commands.push("BT");
      commands.push(`/F2 14 Tf`);
      commands.push(`${hexToRgb(COLORS.green)} rg`);
      commands.push(`1 0 0 1 ${PAGE.margin} ${item.y} Tm`);
      commands.push(`(${escapePdfText(item.text)}) Tj`);
      commands.push("ET");
      continue;
    }

    commands.push("BT");
    commands.push(`/F1 11.5 Tf`);
    commands.push(`${hexToRgb(COLORS.slate)} rg`);
    commands.push(`1 0 0 1 ${PAGE.margin} ${item.y} Tm`);
    commands.push("15 TL");
    item.lines.forEach((line, index) => {
      commands.push(`(${escapePdfText(line)}) Tj`);
      if (index < item.lines.length - 1) {
        commands.push("T*");
      }
    });
    commands.push("ET");
  }

  commands.push("BT");
  commands.push(`/F1 9 Tf`);
  commands.push(`${hexToRgb(COLORS.muted)} rg`);
  commands.push(`1 0 0 1 ${PAGE.margin} 28 Tm`);
  commands.push(`(Doria Stage 3 Pitch | Aligned to sample finals deck flow) Tj`);
  commands.push("ET");

  commands.push("BT");
  commands.push(`/F1 9 Tf`);
  commands.push(`${hexToRgb(COLORS.muted)} rg`);
  commands.push(`1 0 0 1 ${PAGE.width - PAGE.margin - 40} 28 Tm`);
  commands.push(`(${pageNumber}/${totalPages}) Tj`);
  commands.push("ET");

  return commands.join("\n");
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
}

function buildPdf(pages) {
  const objects = [];

  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const font1 = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const font2 = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const pageObjectIds = [];
  const contentIds = [];

  pages.forEach((items, index) => {
    const stream = contentStreamForPage(items, index + 1, pages.length);
    const contentId = addObject(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
    contentIds.push(contentId);
    pageObjectIds.push(null);
  });

  const pagesId = addObject("<< /Type /Pages /Count 0 /Kids [] >>");

  pages.forEach((_, index) => {
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${contentIds[index]} 0 R >>`
    );
    pageObjectIds[index] = pageId;
  });

  objects[pagesId - 1] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] >>`;
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  fs.writeFileSync(outputPath, pdf, "binary");
}

const markdown = fs.readFileSync(sourcePath, "utf8");
const blocks = parseMarkdown(markdown);
const pages = paginate(blocks);
buildPdf(pages);
console.log(`Wrote ${outputPath}`);
