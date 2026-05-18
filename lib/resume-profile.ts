import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { resumeContextFilePaths } from "@/lib/resume-context";

export type ResumeProfile = {
  fullName: string;
  firstName: string;
  email: string;
  phone: string;
  githubUrl: string;
  linkedinUrl: string;
  updatedAt: string;
};

function emptyProfile(): ResumeProfile {
  return {
    fullName: "",
    firstName: "",
    email: "",
    phone: "",
    githubUrl: "",
    linkedinUrl: "",
    updatedAt: "",
  };
}

export async function getResumeProfile(): Promise<ResumeProfile> {
  try {
    const { dir } = resumeContextFilePaths();
    const raw = await readFile(path.join(dir, "profile.json"), "utf8");
    const p = JSON.parse(raw) as Partial<ResumeProfile>;
    return {
      ...emptyProfile(),
      ...p,
      updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : "",
    };
  } catch {
    return emptyProfile();
  }
}

export async function saveResumeProfile(
  input: Omit<ResumeProfile, "updatedAt">
): Promise<ResumeProfile> {
  const { dir } = resumeContextFilePaths();
  await mkdir(dir, { recursive: true });
  const out: ResumeProfile = {
    fullName: input.fullName.trim(),
    firstName: input.firstName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    githubUrl: input.githubUrl.trim(),
    linkedinUrl: input.linkedinUrl.trim(),
    updatedAt: new Date().toISOString(),
  };
  await writeFile(
    path.join(dir, "profile.json"),
    JSON.stringify(out, null, 2),
    "utf8"
  );
  return out;
}

/** Minimum fields to show a static header and PDF name. */
export function profileReadyForTailor(p: ResumeProfile): boolean {
  return Boolean(p.fullName.trim() && p.firstName.trim());
}

export function normalizeExternalUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

/** Visible gap between header fields (PDF + HTML; NBSP so browsers don’t collapse spaces). */
export const RESUME_CONTACT_ITEM_SEP = "\u00A0\u00A0\u00A0·\u00A0\u00A0\u00A0";

/**
 * Static header (not from Vertex): name + one horizontal contact row.
 * No emoji — standard PDF fonts mangle emoji and break width/Link layout.
 */
export function buildStaticResumeHeaderMarkdown(p: ResumeProfile): string {
  const parts: string[] = [];
  if (p.email.trim()) {
    const e = p.email.trim();
    parts.push(`[${e}](mailto:${e})`);
  }
  if (p.phone.trim()) {
    parts.push(`Phone: ${p.phone.trim()}`);
  }
  const gh = normalizeExternalUrl(p.githubUrl);
  const li = normalizeExternalUrl(p.linkedinUrl);
  if (gh) parts.push(`[GitHub](${gh})`);
  if (li) parts.push(`[LinkedIn](${li})`);
  const contact = parts.length ? `\n\n${parts.join(RESUME_CONTACT_ITEM_SEP)}` : "";
  return `# ${p.fullName.trim()}${contact}`;
}

/**
 * Vertex is instructed not to emit a header; if it does, strip # title + contact
 * lines before the first real ## section.
 */
export function stripVertexBodyToSections(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (i >= lines.length) return "";

  const first = lines[i].trim();
  if (first.startsWith("#") && !first.startsWith("##")) {
    i++;
    while (i < lines.length && !lines[i].trim()) i++;
    while (i < lines.length && isVertexContactNoise(lines[i])) i++;
    while (i < lines.length && !lines[i].trim()) i++;
  }
  return lines.slice(i).join("\n").trim();
}

function isVertexContactNoise(line: string): boolean {
  const t = line.trim();
  if (!t || t.startsWith("##")) return false;
  return (
    /@|mailto:|\[.*\]\(|https?:|linkedin|github|tel:|^phone\s*:/i.test(t) ||
    /^[\d\s+().-–]{8,}$/.test(t)
  );
}

export function resumePdfDownloadBaseName(firstName: string): string {
  const base =
    firstName
      .trim()
      .replace(/[/\\?%*:|"<>]/g, "-")
      .replace(/\s+/g, "_")
      .slice(0, 80) || "resume";
  return `${base}_resume`;
}
