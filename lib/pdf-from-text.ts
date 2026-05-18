import PDFDocument from "pdfkit";

type PdfDoc = InstanceType<typeof PDFDocument>;

const SECTION =
  /^(Profile|Professional Summary|Summary|Objective|Work Experience|Experience|Professional Experience|Employment|Education|Skills|Technical Skills|Projects|Certifications|Achievements|Languages|Interests)\s*:?\s*$/i;

const BULLET = /^\s*([•\-\*·◦]|\d+[\.\)])\s+/;

type MdPart = { text: string; link?: string };

/** Plain + links + **bold** segments for PDF rendering. */
type MdRun = { text: string; link?: string; bold?: boolean };

function stripOuterCodeFence(text: string): string {
  let t = text.trim();
  if (!t.startsWith("```")) return t;
  t = t.replace(/^```[a-z0-9]*\s*\n?/i, "");
  t = t.replace(/\n?```\s*$/i, "");
  return t.trim();
}

function stripInlineBoldMarkers(s: string): string {
  return s.replace(/\*\*/g, "");
}

function parseMdInlineParts(line: string): MdPart[] {
  const parts: MdPart[] = [];
  const re = /\[([^\]]*)\]\(([^)]+)\)/g;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > i) parts.push({ text: line.slice(i, m.index) });
    parts.push({ text: m[1], link: m[2] });
    i = m.index + m[0].length;
  }
  if (i < line.length) parts.push({ text: line.slice(i) });
  if (parts.length === 0) parts.push({ text: line });
  return parts;
}

/** Split a line into link spans and bold spans (order preserved). */
function parseMdRuns(line: string): MdRun[] {
  const out: MdRun[] = [];
  const re = /\[([^\]]*)\]\(([^)]+)\)|\*\*([\s\S]*?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) {
      out.push({ text: line.slice(last, m.index) });
    }
    if (m[1] !== undefined && m[2] !== undefined) {
      out.push({ text: m[1], link: m[2] });
    } else if (m[3] !== undefined) {
      out.push({ text: m[3], bold: true });
    }
    last = m.index + m[0].length;
  }
  if (last < line.length) {
    out.push({ text: line.slice(last) });
  }
  if (out.length === 0) {
    out.push({ text: line });
  }
  return out;
}

function writeMdRunsFlow(
  doc: PdfDoc,
  runs: MdRun[],
  opts: {
    x: number;
    width: number;
    fontSize: number;
    baseColor?: string;
    linkColor?: string;
    prefix?: string;
    lineGap?: number;
  },
): void {
  const base = opts.baseColor ?? "#222222";
  const linkC = opts.linkColor ?? "#0645ad";
  const { x, width, fontSize } = opts;
  const lineGap = opts.lineGap ?? 2.5;
  const prefix = opts.prefix ?? "";

  const work = runs.filter((r) => r.text !== "" || r.link);
  if (work.length === 0 && prefix) {
    doc
      .font("Helvetica")
      .fillColor(base)
      .fontSize(fontSize)
      .text(prefix, x, doc.y, {
        width,
        align: "left",
        continued: false,
        lineGap,
      });
    return;
  }
  if (work.length === 0 && !prefix) return;

  const total = work.length;
  let idx = 0;

  if (prefix) {
    const more = total > 0;
    doc
      .font("Helvetica")
      .fillColor(base)
      .fontSize(fontSize)
      .text(prefix, x, doc.y, {
        width,
        align: "left",
        continued: more,
        lineGap,
      });
  }

  for (const p of work) {
    const isLast = idx === total - 1;
    idx++;
    if (p.link) {
      doc
        .fillColor(linkC)
        .font("Helvetica")
        .fontSize(fontSize)
        .text(p.text, {
          width,
          align: "left",
          continued: !isLast,
          link: p.link,
          underline: true,
          lineGap,
        });
    } else if (p.bold) {
      doc
        .fillColor(base)
        .font("Helvetica-Bold")
        .fontSize(fontSize)
        .text(p.text, {
          width,
          align: "left",
          continued: !isLast,
          lineGap,
        });
    } else {
      doc
        .fillColor(base)
        .font("Helvetica")
        .fontSize(fontSize)
        .text(p.text, {
          width,
          align: "left",
          continued: !isLast,
          lineGap,
        });
    }
  }
}

/**
 * Renders Markdown link/plain fragments in one logical row without PDFKit's
 * `continued` layout (which stacks/overlaps mixed links on narrow runs).
 */
function writeMdPartsContactRow(
  doc: PdfDoc,
  parts: MdPart[],
  opts: {
    contentLeft: number;
    contentWidth: number;
    fontSize: number;
    horizontalAlign?: "left" | "center";
    baseColor?: string;
    linkColor?: string;
  },
): void {
  const base = opts.baseColor ?? "#444444";
  const linkC = opts.linkColor ?? "#0645ad";
  const { contentLeft, contentWidth, fontSize } = opts;
  const horizontalAlign = opts.horizontalAlign ?? "left";
  const maxRight = contentLeft + contentWidth;
  let x = contentLeft;
  let y = doc.y;
  const lineHeight = doc.currentLineHeight(true) + 1;

  doc.font("Helvetica").fontSize(fontSize);
  let totalWidth = 0;
  for (const p of parts) {
    if (p.text === "" && !p.link) continue;
    totalWidth += doc.widthOfString(p.text);
  }
  if (horizontalAlign === "center" && totalWidth <= contentWidth) {
    x = contentLeft + (contentWidth - totalWidth) / 2;
  }

  for (const p of parts) {
    if (p.text === "" && !p.link) continue;
    const text = p.text;
    doc.font("Helvetica").fontSize(fontSize);
    const w = doc.widthOfString(text);

    if (x + w > maxRight && x > contentLeft) {
      y += lineHeight;
      x = contentLeft;
    }

    if (p.link) {
      doc
        .fillColor(linkC)
        .text(text, x, y, {
          lineBreak: false,
          /* PDFKit requires `width` when combining lineBreak:false + link, or textWidth is NaN */
          width: Math.max(w, 0.1),
          link: p.link,
          underline: true,
        });
    } else {
      doc.fillColor(base).text(text, x, y, { lineBreak: false });
    }
    x += w;
  }

  doc.x = contentLeft;
  doc.y = y + lineHeight;
}

function writeMdPartsLine(
  doc: PdfDoc,
  parts: MdPart[],
  opts: {
    width: number;
    align: "left" | "center";
    fontSize: number;
    baseColor?: string;
    linkColor?: string;
  }
): void {
  const base = opts.baseColor ?? "#222222";
  const linkC = opts.linkColor ?? "#0645ad";
  const align = opts.align;
  const width = opts.width;
  const fontSize = opts.fontSize;
  const last = parts.length - 1;

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const continued = i < last;
    if (p.text === "" && !p.link) continue;
    if (p.link) {
      doc
        .fillColor(linkC)
        .font("Helvetica")
        .fontSize(fontSize)
        .text(p.text, {
          width,
          align,
          continued,
          link: p.link,
          underline: true,
          lineGap: 1,
        });
    } else {
      doc
        .fillColor(base)
        .font("Helvetica")
        .fontSize(fontSize)
        .text(p.text, {
          width,
          align,
          continued,
          lineGap: 1,
        });
    }
  }
}

function isContactLine(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (/^phone\s*:/i.test(t)) return true;
  if (/^\[([^\]]+)\]\([^)]+\)\s*$/.test(t) && t.length < 220) return true;
  if (/\[([^\]]+)\]\([^)]+\)/.test(t) && t.length < 220) return true;
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
  const t = stripInlineBoldMarkers(s.trim());
  if (!t || t.length > 160) return false;
  if (SECTION.test(t)) return false;
  if (BULLET.test(s)) return false;
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
  const head = t.match(/^([^(]{1,60})\(/);
  if (
    head &&
    !roleCue &&
    (hasYear || hasParenDate) &&
    head[1].trim().length >= 2 &&
    head[1].trim().length < 58 &&
    /^[A-Za-z0-9]/.test(head[1].trim()) &&
    !/\b(I|We|Our|Led|Built|Worked|Responsible)\b/i.test(head[1])
  ) {
    return true;
  }
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

  if (i < lines.length) {
    const first = lines[i].trim();
    const h1 = first.match(/^#\s+(.+)$/);
    if (h1 && !first.startsWith("##")) {
      doc
        .font("Helvetica-Bold")
        .fontSize(22)
        .fillColor("#0a0a0a")
        .text(h1[1].trim(), left, doc.y, {
          width,
          align: "center",
          lineGap: 2,
        });
      doc.moveDown(0.35);
      i++;
    } else if (isLikelyNameLine(lines[i])) {
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
  }

  /* Blank line between `# Title` and contact row — skip it so contact uses centered header layout */
  while (i < lines.length && !lines[i].trim()) i++;

  let contactCount = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) break;
    if (!isContactLine(t)) break;
    const parts = parseMdInlineParts(t);
    const hasLink = parts.some((p) => p.link);
    if (hasLink) {
      writeMdPartsContactRow(doc, parts, {
        contentLeft: left,
        contentWidth: width,
        fontSize: 9.5,
        horizontalAlign: "center",
        baseColor: "#444444",
      });
    } else if (parts.length > 1) {
      writeMdPartsLine(doc, parts, {
        width,
        align: "center",
        fontSize: 9.5,
        baseColor: "#444444",
      });
    } else {
      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor("#444444")
        .text(stripInlineBoldMarkers(t), left, doc.y, {
          width,
          align: "center",
          lineGap: 1,
        });
    }
    doc.moveDown(0.18);
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

    const h1mid = trimmed.match(/^#\s+(.+)$/);
    if (h1mid && !trimmed.startsWith("##")) {
      doc.moveDown(0.35);
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor("#0a0a0a")
        .text(h1mid[1].trim(), left, doc.y, { width, lineGap: 2 });
      doc.moveDown(0.45);
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
        .text(stripInlineBoldMarkers(mdHeading[1].trim()), left, doc.y, {
          width,
          lineGap: 2,
        });
      const yRule = doc.y - 1;
      drawSectionRule(doc, left, yRule, width);
      doc.moveDown(0.55);
      i++;
      continue;
    }

    if (SECTION.test(trimmed)) {
      doc.moveDown(0.4);
      const title = stripInlineBoldMarkers(trimmed.replace(/:\s*$/, ""));
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
      const bodyRaw = stripBullet(raw);
      const runs = parseMdRuns(bodyRaw);
      const widthB = width - 12;
      const x0 = left + 6;
      const hasComplex = runs.some((r) => r.bold || r.link);
      doc.font("Helvetica").fontSize(10);
      if (hasComplex) {
        writeMdRunsFlow(doc, runs, {
          x: x0,
          width: widthB,
          fontSize: 10,
          baseColor: "#222222",
          prefix: "•  ",
          lineGap: 2.5,
        });
      } else {
        doc
          .fillColor("#222222")
          .text(`•  ${stripInlineBoldMarkers(bodyRaw)}`, x0, doc.y, {
            width: widthB,
            align: "left",
            lineGap: 2.5,
          });
      }
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
        .text(stripInlineBoldMarkers(trimmed), left, doc.y, {
          width,
          lineGap: 2,
        });
      doc.moveDown(0.12);
      i++;
      continue;
    }

    const runs = parseMdRuns(trimmed);
    const needsRich = runs.some((r) => r.bold || r.link);
    if (needsRich) {
      writeMdRunsFlow(doc, runs, {
        x: left,
        width,
        fontSize: 10,
        baseColor: "#222222",
        lineGap: 3,
      });
    } else {
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#222222")
        .text(stripInlineBoldMarkers(trimmed), left, doc.y, {
          width,
          align: "left",
          lineGap: 3,
        });
    }
    doc.moveDown(0.08);
    i++;
  }
}

/**
 * Build a readable resume-style PDF from plain text or Markdown (heuristic layout).
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

    const normalized = stripOuterCodeFence(text)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");
    const lines = normalized.split("\n");
    renderResumeBody(doc, lines);
    doc.end();
  });
}
