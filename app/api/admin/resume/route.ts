import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError } from "@/lib/http";
import {
  getResumeMeta,
  saveOriginalResume,
} from "@/lib/resume-context";
import {
  getResumeProfile,
  profileReadyForTailor,
  saveResumeProfile,
} from "@/lib/resume-profile";

export const dynamic = "force-dynamic";

const ALLOWED_UPLOAD = new Set([
  "application/pdf",
  "text/plain",
  "application/octet-stream",
]);

const putProfileSchema = z.object({
  fullName: z.string().min(1).max(120),
  firstName: z.string().min(1).max(80),
  email: z.string().max(200).optional().default(""),
  phone: z.string().max(40).optional().default(""),
  githubUrl: z.string().max(500).optional().default(""),
  linkedinUrl: z.string().max(500).optional().default(""),
});

export async function GET() {
  try {
    const [meta, profile] = await Promise.all([getResumeMeta(), getResumeProfile()]);
    return NextResponse.json({
      meta,
      profile,
      hasResume: Boolean(meta),
      profileReadyForTailor: profileReadyForTailor(profile),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to read resume";
    return jsonError(message, 500);
  }
}

export async function PUT(request: Request) {
  try {
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return jsonError("Expected JSON body", 400);
    }
    const parsed = putProfileSchema.safeParse(json);
    if (!parsed.success) {
      return jsonError(
        parsed.error.issues.map((i) => i.message).join("; "),
        400
      );
    }
    const profile = await saveResumeProfile(parsed.data);
    return NextResponse.json({ ok: true, profile });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Save failed";
    return jsonError(message, 500);
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return jsonError("Expected multipart/form-data", 415);
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonError('Missing file field "file"', 400);
    }

    const mime = (file.type || "").toLowerCase().split(";")[0].trim();
    if (
      mime &&
      !ALLOWED_UPLOAD.has(mime) &&
      !file.name.toLowerCase().endsWith(".pdf") &&
      !file.name.toLowerCase().endsWith(".txt")
    ) {
      return jsonError("Upload a PDF or .txt resume", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let effectiveType = mime;
    if (!effectiveType || effectiveType === "application/octet-stream") {
      if (file.name.toLowerCase().endsWith(".pdf")) {
        effectiveType = "application/pdf";
      } else if (file.name.toLowerCase().endsWith(".txt")) {
        effectiveType = "text/plain";
      }
    }

    if (
      !effectiveType ||
      (effectiveType !== "application/pdf" && effectiveType !== "text/plain")
    ) {
      return jsonError(
        "Could not detect file type. Upload a file ending in .pdf or .txt",
        400
      );
    }

    const meta = await saveOriginalResume({
      filename: file.name,
      mimeType: effectiveType,
      buffer,
    });

    return NextResponse.json({ ok: true, meta });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return jsonError(message, 400);
  }
}
