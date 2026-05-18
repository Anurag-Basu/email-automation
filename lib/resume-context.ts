import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { DATA_DIR } from "@/lib/paths";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_CONTEXT_CHARS = 400_000;

const ALLOWED_MIME = new Set(["application/pdf", "text/plain"]);

export type ResumeMeta = {
  mimeType: string;
  originalFilename: string;
  savedAt: string;
  textChars: number;
};

function userResumeDir(): string {
  return path.join(DATA_DIR, "user-resume");
}

export function resumeContextFilePaths() {
  const dir = userResumeDir();
  return {
    dir,
    meta: path.join(dir, "meta.json"),
    context: path.join(dir, "context.txt"),
    originalPdf: path.join(dir, "original.pdf"),
    originalTxt: path.join(dir, "original.txt"),
  };
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const { extractPlainTextFromPdfBuffer } = await import("@/lib/extract-pdf-text");
  return extractPlainTextFromPdfBuffer(buffer);
}

function normalizeContextText(raw: string): string {
  return raw.replace(/\0/g, "").trim().slice(0, MAX_CONTEXT_CHARS);
}

/**
 * Save the user's original resume (PDF or plain text). Writes `context.txt` for Vertex prompts.
 */
export async function saveOriginalResume(input: {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<ResumeMeta> {
  const mime = input.mimeType.toLowerCase().split(";")[0].trim();
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error("Only PDF or .txt resumes are supported.");
  }

  const buffer = input.buffer;
  if (buffer.length === 0) {
    throw new Error("File is empty.");
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error(`File exceeds ${MAX_BYTES / (1024 * 1024)} MB limit.`);
  }

  const paths = resumeContextFilePaths();
  await mkdir(paths.dir, { recursive: true });

  let text: string;
  if (mime === "application/pdf") {
    text = await extractTextFromPdf(buffer);
    await writeFile(paths.originalPdf, buffer);
  } else {
    text = normalizeContextText(buffer.toString("utf8"));
    await writeFile(paths.originalTxt, buffer);
  }

  text = normalizeContextText(text);
  if (!text) {
    throw new Error(
      "Could not read any text from this file. Try a text-based PDF or a .txt resume."
    );
  }

  await writeFile(paths.context, text, "utf8");

  const meta: ResumeMeta = {
    mimeType: mime,
    originalFilename: input.filename.slice(0, 240) || "resume",
    savedAt: new Date().toISOString(),
    textChars: text.length,
  };
  await writeFile(paths.meta, JSON.stringify(meta, null, 2), "utf8");

  return meta;
}

/** Plain text extracted / stored for Vertex (JD tailoring, etc.). */
export async function getResumeContextText(): Promise<string | null> {
  try {
    const { context } = resumeContextFilePaths();
    const t = await readFile(context, "utf8");
    const s = t.trim();
    return s.length ? s : null;
  } catch {
    return null;
  }
}

/** Use in Vertex flows that need your canonical resume text. */
export async function requireResumeContextText(): Promise<string> {
  const t = await getResumeContextText();
  if (!t) {
    throw new Error(
      "No saved resume on file. Upload your resume under Settings first."
    );
  }
  return t;
}

export async function getResumeMeta(): Promise<ResumeMeta | null> {
  try {
    const raw = await readFile(resumeContextFilePaths().meta, "utf8");
    const parsed = JSON.parse(raw) as ResumeMeta;
    if (
      typeof parsed.savedAt === "string" &&
      typeof parsed.textChars === "number"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
