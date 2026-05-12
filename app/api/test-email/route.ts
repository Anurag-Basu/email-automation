import { NextResponse } from "next/server";
import { z } from "zod";

import { isSmtpConfigured, sendTestEmail } from "@/lib/email";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Whether real SMTP is bypassed (no network send). */
export async function GET() {
  if (process.env.DISABLE_EMAIL_TEST === "true") {
    return jsonError("Test email route is disabled", 404);
  }
  const dryRun = process.env.SMTP_DRY_RUN === "true";
  return NextResponse.json({
    dryRunMode: dryRun,
    smtpConfigured: isSmtpConfigured(),
  });
}

const bodySchema = z.object({
  to: z.email(),
  subject: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(50_000),
});

export async function POST(request: Request) {
  try {
    if (process.env.DISABLE_EMAIL_TEST === "true") {
      return jsonError("Test email route is disabled", 404);
    }

    if (!isSmtpConfigured()) {
      return jsonError(
        "Email is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, EMAIL_FROM, or use SMTP_DRY_RUN=true.",
        503
      );
    }

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return jsonError("Expected JSON body", 400);
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join("; ");
      return jsonError(msg, 400);
    }

    const subject =
      parsed.data.subject?.trim() ||
      "Lead automation — SMTP test";

    const result = await sendTestEmail({
      to: parsed.data.to,
      subject,
      text: parsed.data.body,
    });

    return NextResponse.json({
      ok: true,
      messageId: result.messageId,
      dryRun: "dryRun" in result && result.dryRun === true,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to send test email";
    return jsonError(message, 500);
  }
}
