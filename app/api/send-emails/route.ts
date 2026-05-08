import { NextResponse } from "next/server";

import { isSmtpConfigured, sendLeadEmail } from "@/lib/email";
import { jsonError } from "@/lib/http";
import { processPendingSends } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    if (!isSmtpConfigured()) {
      return jsonError(
        "Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, or use SMTP_DRY_RUN=true for a no-op send.",
        503
      );
    }

    const results = await processPendingSends((lead) =>
      sendLeadEmail(lead).then(() => undefined)
    );

    const sent = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    return NextResponse.json({
      ok: true,
      processed: results.length,
      sent,
      failed,
      results,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Send pipeline failed";
    return jsonError(message, 500);
  }
}
