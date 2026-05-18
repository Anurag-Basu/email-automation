import { z } from "zod";

const emailSchema = z.email();

/** RFC-like; used only to discover candidates before z.email() */
const EMAIL_LIKE =
  /\b[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}\b/g;

const MAX_EMAIL_HUNT = 24_000;

function stripEmailDecor(s: string): string {
  return s
    .replace(/^mailto:/i, "")
    .replace(/^<+|>+$/g, "")
    .replace(/^\(+|\)+$/g, "")
    .replace(/^[\s"'`]+|[\s"'`]+$/g, "")
    .replace(/\.$/, "")
    .trim();
}

function collectEmailCandidates(emailsField: string, extraText: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string) => {
    const t = stripEmailDecor(raw);
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  const ef = emailsField.slice(0, MAX_EMAIL_HUNT);
  const xt = extraText.slice(0, MAX_EMAIL_HUNT);

  for (const part of ef.split(/[\|\n\r;,]+|(?:\s+or\s+)/i)) {
    push(part);
  }
  for (const m of ef.matchAll(EMAIL_LIKE)) push(m[0]);
  for (const m of xt.matchAll(EMAIL_LIKE)) push(m[0]);

  return out;
}

function firstValidEmail(emailsField: string, extraText: string): string | null {
  for (const c of collectEmailCandidates(emailsField, extraText)) {
    if (emailSchema.safeParse(c).success) return c;
  }
  return null;
}

/**
 * Dedupe repeated lines (LinkedIn scrapes often duplicate the name block),
 * collapse whitespace, dedupe consecutive identical tokens.
 */
export function sanitizeAuthor(raw: string): string {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const seenLine = new Set<string>();
  const uniqueLines: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seenLine.has(key)) continue;
    seenLine.add(key);
    uniqueLines.push(line);
  }
  let s = uniqueLines.join(" ").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const words = s.split(" ");
  const deduped: string[] = [];
  for (const w of words) {
    if (
      deduped.length &&
      deduped[deduped.length - 1].toLowerCase() === w.toLowerCase()
    ) {
      continue;
    }
    deduped.push(w);
  }
  return deduped.join(" ").slice(0, 500);
}

export function sanitizeDescription(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 5000);
}

export function sanitizeLeadFields(row: {
  author: string;
  email: string;
  description: string;
}): { author: string; email: string; description: string } {
  const description = sanitizeDescription(row.description);
  const email =
    firstValidEmail(row.email.trim(), `${row.email}\n${row.description}`) ?? "";
  const author = sanitizeAuthor(row.author);
  return { author, email, description };
}
