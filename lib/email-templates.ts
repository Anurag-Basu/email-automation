import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { DATA_DIR } from "@/lib/paths";
import type { LeadCategory } from "@/lib/types";
import { normalizeExternalUrl } from "@/lib/resume-profile";

const FILE = path.join(DATA_DIR, "email-templates.json");

export type CategoryEmailTemplate = {
  subject: string;
  bodyHtml: string;
};

export type EmailTemplatesFile = {
  frontend: CategoryEmailTemplate;
  fullstack: CategoryEmailTemplate;
  other: CategoryEmailTemplate;
  updatedAt: string;
};

function defaultTemplates(): Omit<EmailTemplatesFile, "updatedAt"> {
  return {
    frontend: {
      subject:
        "Frontend Developer | React.js, Next.js, Node.js  | Immediate joiner",
      bodyHtml: `<p>Dear,</p>
<p>I hope you're doing well. I'm {{fullName}}, a Frontend Developer with 4.5+ years of experience building high-performance web applications using React.js, Next.js, and modern UI frameworks. Alongside my core frontend expertise, I also bring 1 year of full-stack experience with Node.js and databases like MongoDB and PostgreSQL.</p>
<p>I came across your job opening and found it closely aligned with my skill set and project background. I'm available to join immediately and have attached my resume for your reference.</p>
<p>Looking forward to the opportunity to connect.</p>
<p>Best regards,<br>{{fullName}}</p>
<p>{{phone}}<br><a href="mailto:{{email}}">{{email}}</a><br>{{linkedinLink}}</p>`,
    },
    fullstack: {
      subject: "Full-Stack Developer | React.js, Node.js | Immediate Joiner",
      bodyHtml: `<p>Dear,</p>
<p>I hope you're doing well. I'm {{fullName}}, a Frontend Developer with 4+ years of experience building high-performance web applications using React.js, Next.js, and modern UI frameworks. Alongside my core frontend expertise, I also bring 1 year of full-stack experience with Node.js and databases like MongoDB and PostgreSQL.</p>
<p>I came across your job opening and found it closely aligned with my skill set and project background. I'm available to join immediately and have attached my resume for your reference.</p>
<p>Looking forward to the opportunity to connect.</p>
<p>Best regards,<br>{{fullName}}</p>
<p>{{phone}}<br><a href="mailto:{{email}}">{{email}}</a><br>{{linkedinLink}}</p>`,
    },
    other: {
      subject:
        "Software Engineer | React.js, Next.js, Node.js | Immediate joiner",
      bodyHtml: `<p>Dear,</p>
<p>I hope you're doing well. I'm {{fullName}}, a software engineer with strong experience building web applications using React.js, Next.js, and related stacks. I also bring hands-on experience with Node.js and databases like MongoDB and PostgreSQL.</p>
<p>I came across your job opening and found it closely aligned with my skill set and project background. I'm available to join immediately and have attached my resume for your reference.</p>
<p>Looking forward to the opportunity to connect.</p>
<p>Best regards,<br>{{fullName}}</p>
<p>{{phone}}<br><a href="mailto:{{email}}">{{email}}</a><br>{{linkedinLink}}</p>`,
    },
  };
}

function mergeWithDefaults(
  partial: Partial<Record<LeadCategory, Partial<CategoryEmailTemplate>>>,
): Omit<EmailTemplatesFile, "updatedAt"> {
  const d = defaultTemplates();
  const merge = (cat: LeadCategory): CategoryEmailTemplate => ({
    subject: partial[cat]?.subject?.trim() || d[cat].subject,
    bodyHtml: partial[cat]?.bodyHtml?.trim() || d[cat].bodyHtml,
  });
  return {
    frontend: merge("frontend"),
    fullstack: merge("fullstack"),
    other: merge("other"),
  };
}

export async function getEmailTemplates(): Promise<
  Omit<EmailTemplatesFile, "updatedAt">
> {
  try {
    const raw = await readFile(FILE, "utf8");
    const p = JSON.parse(raw) as Partial<EmailTemplatesFile>;
    return mergeWithDefaults({
      frontend: p.frontend,
      fullstack: p.fullstack,
      other: p.other,
    });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return defaultTemplates();
    throw e;
  }
}

export async function saveEmailTemplates(
  data: Omit<EmailTemplatesFile, "updatedAt">,
): Promise<EmailTemplatesFile> {
  await mkdir(DATA_DIR, { recursive: true });
  const out: EmailTemplatesFile = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(FILE, JSON.stringify(out, null, 2), "utf8");
  return out;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Interpolate {{key}}; `raw` values are inserted verbatim (trusted HTML only). */
export function interpolateTemplate(
  template: string,
  vars: Record<string, string>,
  raw: Record<string, string> = {},
): string {
  let s = template;
  for (const [key, val] of Object.entries(raw)) {
    s = s.split(`{{${key}}}`).join(val);
  }
  for (const [key, val] of Object.entries(vars)) {
    s = s.split(`{{${key}}}`).join(val);
  }
  return s;
}

export function buildLinkedinLink(linkedinUrlRaw: string): string {
  const u = normalizeExternalUrl(linkedinUrlRaw);
  if (!u) return "LinkedIn";
  return `<a href="${escapeHtml(u)}">LinkedIn</a>`;
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<a\s+[^>]*href=["']([^"']*)["'][^>]*>([^<]*)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
