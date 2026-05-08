import { NextResponse } from "next/server";

import { classifyDescription } from "@/lib/classify";
import { parseLeadCsv } from "@/lib/csv";
import { jsonError } from "@/lib/http";
import { importLeads } from "@/lib/storage";
import { prepareLeadRowsForImport } from "@/lib/validation";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["text/csv", "application/csv", "application/vnd.ms-excel"]);
const MAX_SKIPPED_IN_RESPONSE = 150;

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return jsonError("Expected multipart/form-data upload", 415);
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return jsonError('Missing file field "file"', 400);
    }

    if (file.size === 0) {
      return jsonError("Uploaded file is empty", 400);
    }

    const mime = (file.type || "").toLowerCase();
    if (mime && !ALLOWED.has(mime) && !mime.includes("csv")) {
      return jsonError("Please upload a CSV file", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let rows;
    try {
      rows = parseLeadCsv(buffer);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not parse CSV";
      return jsonError(msg, 400);
    }

    const { valid, skipped } = prepareLeadRowsForImport(rows);

    if (!valid.length) {
      const sample = skipped.slice(0, 25).map((s) => `Row ${s.line}: ${s.reason}`);
      return NextResponse.json(
        {
          error:
            "No rows with a valid email after cleaning. Check column names (e.g. Emails Found, Post Snippet) or add contact emails.",
          rowErrors: sample,
          skippedCount: skipped.length,
        },
        { status: 422 }
      );
    }

    const leads = await importLeads(valid, classifyDescription);
    const skippedPayload = skipped.slice(0, MAX_SKIPPED_IN_RESPONSE);
    return NextResponse.json({
      ok: true,
      count: leads.length,
      skippedCount: skipped.length,
      skipped: skippedPayload,
      skippedTruncated: skipped.length > MAX_SKIPPED_IN_RESPONSE,
      leads,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return jsonError(message, 500);
  }
}
