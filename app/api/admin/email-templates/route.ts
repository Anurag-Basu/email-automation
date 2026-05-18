import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getEmailTemplates,
  saveEmailTemplates,
} from "@/lib/email-templates";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const categorySchema = z.object({
  subject: z.string().min(1).max(500),
  bodyHtml: z.string().min(1).max(60_000),
});

const putSchema = z.object({
  frontend: categorySchema,
  fullstack: categorySchema,
  other: categorySchema,
});

export async function GET() {
  try {
    const templates = await getEmailTemplates();
    return NextResponse.json({ templates });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to read templates";
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
    const p = putSchema.safeParse(json);
    if (!p.success) {
      return jsonError(
        p.error.issues.map((i) => i.message).join("; "),
        400,
      );
    }
    const saved = await saveEmailTemplates(p.data);
    return NextResponse.json({ ok: true, ...saved });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Save failed";
    return jsonError(message, 500);
  }
}
