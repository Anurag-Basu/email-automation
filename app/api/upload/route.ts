import { NextResponse } from "next/server";

import { classifyDescriptionsWithVertex } from "@/lib/classify-vertex";
import { parseLeadCsv } from "@/lib/csv";
import { isVertexEnvConfigured } from "@/lib/vertex-genai";
import type { LeadCategory } from "@/lib/types";
import { jsonError } from "@/lib/http";
import { importLeads } from "@/lib/storage";
import { prepareLeadRowsForImport } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
      return jsonError("Please upload a .csv spreadsheet", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let rows;
    try {
      rows = parseLeadCsv(buffer);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not parse CSV";
      return jsonError(msg, 400);
    }

    const { valid, skipped, duplicateEmailsDropped } = prepareLeadRowsForImport(rows);

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

    const rowsNeedingAi = valid.filter((r) => r.csvCategory === null);

    if (rowsNeedingAi.length > 0 && !isVertexEnvConfigured()) {
      return jsonError(
        "Some rows need AI to pick a role (missing or unknown Category/Label), but Google Cloud is not set up. Add GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION, or add a Category column with values frontend, fullstack, or other on every row.",
        503
      );
    }

    let usedAiForCategories = false;
    let categories: LeadCategory[];

    if (rowsNeedingAi.length === 0) {
      categories = valid.map((r) => r.csvCategory!);
    } else if (rowsNeedingAi.length === valid.length) {
      usedAiForCategories = true;
      try {
        categories = await classifyDescriptionsWithVertex(
          valid.map((r) => r.description)
        );
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Could not sort contacts by role (AI error)";
        return jsonError(msg, 502);
      }
    } else {
      usedAiForCategories = true;
      try {
        const aiLabels = await classifyDescriptionsWithVertex(
          rowsNeedingAi.map((r) => r.description)
        );
        let k = 0;
        categories = valid.map((r) =>
          r.csvCategory !== null ? r.csvCategory : aiLabels[k++]!
        );
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Could not sort contacts by role (AI error)";
        return jsonError(msg, 502);
      }
    }

    const rowsWithCategory = valid.map((r, i) => ({
      author: r.author,
      email: r.email,
      description: r.description,
      category: categories[i]!,
    }));

    const leads = await importLeads(rowsWithCategory);
    const skippedPayload = skipped.slice(0, MAX_SKIPPED_IN_RESPONSE);
    const categoryCounts = leads.reduce(
      (acc, l) => {
        acc[l.category]++;
        return acc;
      },
      { frontend: 0, fullstack: 0, other: 0 }
    );
    return NextResponse.json({
      ok: true,
      count: leads.length,
      skippedCount: skipped.length,
      duplicateEmailsDropped,
      categories: categoryCounts,
      skipped: skippedPayload,
      skippedTruncated: skipped.length > MAX_SKIPPED_IN_RESPONSE,
      usedAiForCategories,
      leads,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return jsonError(message, 500);
  }
}
