import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { z } from "zod";

import { buildPdfFromPlainText } from "@/lib/pdf-from-text";
import { isSmtpConfigured, sendLeadEmail } from "@/lib/email";
import { jsonError } from "@/lib/http";
import { DATA_DIR } from "@/lib/paths";
import { requireResumeContextText } from "@/lib/resume-context";
import { getResumeProfile, profileReadyForTailor } from "@/lib/resume-profile";
import { SEND_EMAIL_BATCH_SIZE } from "@/lib/send-email-batch";
import {
  processPendingSends,
} from "@/lib/storage";
import { tailorResumeMarkdown } from "@/lib/tailor-resume-pipeline";
import type { Lead, LeadCategory } from "@/lib/types";
import { isVertexEnvConfigured } from "@/lib/vertex-genai";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const postBodySchema = z.object({
  category: z.enum(["frontend", "fullstack", "other"]).optional(),
  batchSize: z.coerce.number().int().min(1).max(50).optional(),
});

function fallbackJobDescription(lead: Lead): string {
  const fromEnv = process.env.EMAIL_FALLBACK_JD?.trim();
  const d = lead.description.trim();
  if (d) return d;
  if (fromEnv) return fromEnv;
  return "Professional opportunity; additional role context was not available for this lead.";
}

async function parsePostJson(
  request: Request,
): Promise<{ category?: LeadCategory; batchSize: number }> {
  const raw = await request.text();
  if (!raw.trim()) {
    return { batchSize: SEND_EMAIL_BATCH_SIZE };
  }
  let json: unknown;
  try {
    json = JSON.parse(raw) as unknown;
  } catch {
    return { batchSize: SEND_EMAIL_BATCH_SIZE };
  }
  const p = postBodySchema.safeParse(json);
  if (!p.success) {
    return { batchSize: SEND_EMAIL_BATCH_SIZE };
  }
  return {
    category: p.data.category,
    batchSize: p.data.batchSize ?? SEND_EMAIL_BATCH_SIZE,
  };
}

export async function POST(request: Request) {
  try {
    if (!isSmtpConfigured()) {
      return jsonError(
        "Outgoing email is not set up. Add your mail-server settings (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM) to your .env file, or set SMTP_DRY_RUN=true to practice without sending.",
        503,
      );
    }

    if (!isVertexEnvConfigured()) {
      return jsonError(
        "The AI connection (Google Cloud) is not set up. Add GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION to your .env file — same values you use for importing contacts.",
        503,
      );
    }

    const profile = await getResumeProfile();
    if (!profileReadyForTailor(profile)) {
      return jsonError(
        "Add your full name and first name under Settings → Name & contact on PDFs before sending.",
        503,
      );
    }

    try {
      await requireResumeContextText();
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Upload your resume under Settings before sending.";
      return jsonError(message, 503);
    }

    const { category, batchSize } = await parsePostJson(request);
    const sendTempDir = path.join(DATA_DIR, "send-temp");
    await mkdir(sendTempDir, { recursive: true });

    const { results, morePending } = await processPendingSends(async (lead) => {
      const jd = fallbackJobDescription(lead);
      let tempPath: string | null = null;
      try {
        const { markdown, pdfDownloadBaseName } =
          await tailorResumeMarkdown(jd);
        const pdfBuffer = await buildPdfFromPlainText(markdown);
        const tempName = `resume-${lead.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.pdf`;
        tempPath = path.join(sendTempDir, tempName);
        const attachmentFilename = `${pdfDownloadBaseName}.pdf`;

        await writeFile(tempPath, pdfBuffer);
        await sendLeadEmail(lead, {
          path: tempPath,
          filename: attachmentFilename,
        });
      } finally {
        if (tempPath) {
          await unlink(tempPath).catch(() => undefined);
        }
      }
    }, { category, maxSendAttempts: batchSize });

    const emailed = results.filter((r) => r.ok && !r.duplicateSkip).length;
    const skippedDuplicates = results.filter((r) => r.duplicateSkip).length;
    const failed = results.filter((r) => !r.ok).length;

    return NextResponse.json({
      ok: true,
      processed: results.length,
      sent: emailed,
      skippedDuplicates,
      failed,
      results,
      category: category ?? null,
      morePending,
      batchSize,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Send pipeline failed";
    return jsonError(message, 500);
  }
}
