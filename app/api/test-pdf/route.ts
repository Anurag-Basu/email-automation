import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError } from "@/lib/http";
import { buildPdfFromPlainText } from "@/lib/pdf-from-text";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  text: z.string().min(1).max(120_000),
  filename: z.string().max(120).optional(),
});

function safePdfFilename(raw: string | undefined): string {
  let name = (raw?.trim() || "resume-preview").replace(/[/\\?%*:|"<>]/g, "-");
  if (!name.toLowerCase().endsWith(".pdf")) {
    name = `${name}.pdf`;
  }
  return name.slice(0, 120);
}

export async function POST(request: Request) {
  try {
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

    const buffer = await buildPdfFromPlainText(parsed.data.text);
    const name = safePdfFilename(parsed.data.filename);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "PDF generation failed";
    return jsonError(message, 500);
  }
}
