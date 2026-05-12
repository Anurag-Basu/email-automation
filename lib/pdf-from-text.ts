import PDFDocument from "pdfkit";

type PdfDoc = InstanceType<typeof PDFDocument>;

const SECTION =
  /^(Profile|Summary|Objective|Work Experience|Experience|Professional Experience|Employment|Education|Skills|Technical Skills|Projects|Certifications|Achievements|Languages|Interests)\s*:?\s*$/i;

const BULLET = /^\s*([•\-\*·◦]|\d+[\.\)])\s+/;

function isContactLine(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (/@\S+\.\S+/.test(t)) return true;
  if (/https?:\/\//i.test(t)) return true;
  if (/github\.com|linkedin\.com/i.test(t)) return true;
  if (/\b(github|linkedin)\b/i.test(t) && t.length < 120) return true;
  if (/\+?\d[\d\s().-]{8,}\d/.test(t)) return true;
  if (/^\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/.test(t)) return true;
  return false;
}

function isLikelyNameLine(s: string): boolean {
  const t = s.trim();
  if (!t || t.length > 70 || t.length < 3) return false;
  if (/@|http|\+?\d{3}[-.\s]\d{3}/.test(t)) return false;
  if (SECTION.test(t)) return false;
  if (!/^[A-Za-zÀ-ÿ\s'.-]+$/.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.length <= 6;
}

function isLikelyRoleHeading(s: string): boolean {
  const t = s.trim();
  if (!t || t.length > 160) return false;
  if (SECTION.test(t)) return false;
  if (BULLET.test(t)) return false;
  const hasYear = /\b(19|20)\d{2}\b/.test(t);
  const hasParenDate =
    /\([^)]*\d{4}[^)]*\)/.test(t) ||
    /\([^)]*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[^)]*\)/i.test(
      t
    );
  const roleCue =
    /\b(SDE|Engineer|Developer|Lead|Manager|Intern|Consultant|Freelance|Full[\s-]?Stack|Frontend|Backend)\b/i.test(
      t
    );
  if ((hasYear || hasParenDate) && (roleCue || t.includes("|") || t.includes("—")))
    return true;
  if (t.includes("|") && t.length < 100 && hasYear) return true;
  return false;
}

function stripBullet(s: string): string {
  return s.replace(BULLET, "").trim();
}

function drawSectionRule(doc: PdfDoc, x: number, y: number, width: number) {
  doc
    .save()
    .strokeColor("#333333")
    .lineWidth(0.75)
    .moveTo(x, y)
    .lineTo(x + width, y)
    .stroke()
    .restore();
}

function renderResumeBody(doc: PdfDoc, lines: string[]) {
  const left = doc.page.margins.left;
  const width =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  let i = 0;

  while (i < lines.length && !lines[i].trim()) i++;

  if (i < lines.length && isLikelyNameLine(lines[i])) {
    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#0a0a0a")
      .text(lines[i].trim(), left, doc.y, {
        width,
        align: "center",
        lineGap: 2,
      });
    doc.moveDown(0.35);
    i++;
  }

  let contactCount = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) break;
    if (!isContactLine(t)) break;
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor("#444444")
      .text(t, left, doc.y, { width, align: "center", lineGap: 1 });
    doc.moveDown(0.12);
    i++;
    contactCount++;
  }
  if (contactCount) doc.moveDown(0.45);
  doc.fillColor("#111111");

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) {
      doc.moveDown(0.22);
      i++;
      continue;
    }

    const mdHeading = trimmed.match(/^#{2,3}\s+(.+)$/);
    if (mdHeading) {
      doc.moveDown(0.35);
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor("#0a0a0a")
        .text(mdHeading[1].trim(), left, doc.y, { width, lineGap: 2 });
      const yRule = doc.y - 1;
      drawSectionRule(doc, left, yRule, width);
      doc.moveDown(0.55);
      i++;
      continue;
    }

    if (SECTION.test(trimmed)) {
      doc.moveDown(0.4);
      const title = trimmed.replace(/:\s*$/, "");
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor("#0a0a0a")
        .text(title, left, doc.y, { width, lineGap: 2 });
      const yRule = doc.y - 1;
      drawSectionRule(doc, left, yRule, width);
      doc.moveDown(0.55);
      i++;
      continue;
    }

    if (BULLET.test(raw)) {
      const body = stripBullet(raw).replace(/\*\*/g, "");
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#222222")
        .text(`•  ${body}`, left + 6, doc.y, {
          width: width - 12,
          align: "left",
          lineGap: 2.5,
        });
      doc.moveDown(0.08);
      i++;
      continue;
    }

    if (isLikelyRoleHeading(trimmed)) {
      doc.moveDown(0.08);
      doc
        .font("Helvetica-Bold")
        .fontSize(10.5)
        .fillColor("#111111")
        .text(trimmed.replace(/\*\*/g, ""), left, doc.y, { width, lineGap: 2 });
      doc.moveDown(0.12);
      i++;
      continue;
    }

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#222222")
      .text(trimmed.replace(/\*\*/g, ""), left, doc.y, {
        width,
        align: "left",
        lineGap: 3,
      });
    doc.moveDown(0.08);
    i++;
  }
}

/**
 * Build a readable resume-style PDF from plain text (heuristic layout).
 */
export function buildPdfFromPlainText(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 44, bottom: 48, left: 52, right: 52 },
      autoFirstPage: true,
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", reject);

    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalized.split("\n");
    renderResumeBody(doc, lines);
    doc.end();
  });
}
