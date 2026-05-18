import { NextResponse } from "next/server";
import { z } from "zod";

import { computeAtsKeywordHint } from "@/lib/ats-keyword-hint";
import { jsonError, truncateForApiMessage } from "@/lib/http";
import { getResumeMeta } from "@/lib/resume-context";
import {
  getResumeProfile,
  profileReadyForTailor,
  resumePdfDownloadBaseName,
} from "@/lib/resume-profile";
import {
  attachTestVertexDebug,
  isTestVertexApiDebug,
  testVertexDebugErrorBody,
} from "@/lib/test-vertex-debug";
import { tailorResumeMarkdown } from "@/lib/tailor-resume-pipeline";
import {
  DEFAULT_VERTEX_GEMINI_MODEL,
  generateVertexGeminiText,
  isVertexEnvConfigured,
} from "@/lib/vertex-genai";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const promptBodySchema = z.object({
  prompt: z.string().min(1).max(100_000),
});

const tailorBodySchema = z.object({
  mode: z.literal("tailor"),
  jobDescription: z.string().min(1).max(80_000),
});

function parsePostBody(
  json: unknown,
):
  | { kind: "prompt"; prompt: string }
  | { kind: "tailor"; jobDescription: string }
  | { error: string } {
  if (typeof json !== "object" || json === null) {
    return { error: "Expected JSON object" };
  }
  const o = json as Record<string, unknown>;

  if (o.mode === "tailor") {
    const p = tailorBodySchema.safeParse(json);
    if (!p.success) {
      return {
        error: p.error.issues.map((i) => i.message).join("; "),
      };
    }
    return { kind: "tailor", jobDescription: p.data.jobDescription };
  }

  const p = promptBodySchema.safeParse(json);
  if (!p.success) {
    return { error: p.error.issues.map((i) => i.message).join("; ") };
  }
  return { kind: "prompt", prompt: p.data.prompt };
}

/** Same as `jsonError` unless `DEBUG_TEST_VERTEX` is set and `debug` is passed. */
function routeJsonError(
  message: string,
  status: number,
  debug?: Record<string, unknown>,
): NextResponse {
  if (isTestVertexApiDebug() && debug !== undefined) {
    return NextResponse.json(
      {
        error: truncateForApiMessage(message),
        debug: { ts: new Date().toISOString(), ...debug },
      },
      { status },
    );
  }
  return jsonError(message, status);
}

export async function GET() {
  if (process.env.DISABLE_VERTEX_TEST === "true") {
    return jsonError("AI test route is disabled", 404);
  }
  let meta: Awaited<ReturnType<typeof getResumeMeta>> = null;
  let profile: Awaited<ReturnType<typeof getResumeProfile>> | null = null;
  try {
    meta = await getResumeMeta();
  } catch {
    meta = null;
  }
  try {
    profile = await getResumeProfile();
  } catch {
    profile = null;
  }
  const p = profile ?? {
    fullName: "",
    firstName: "",
    email: "",
    phone: "",
    githubUrl: "",
    linkedinUrl: "",
    updatedAt: "",
  };
  const profileOk = profileReadyForTailor(p);
  const body = attachTestVertexDebug(
    {
      vertexEnvConfigured: isVertexEnvConfigured(),
      hasApplicationCredentials: Boolean(
        process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim(),
      ),
      model:
        process.env.VERTEX_GEMINI_MODEL?.trim() || DEFAULT_VERTEX_GEMINI_MODEL,
      hasResume: Boolean(meta),
      resumeTextChars: meta?.textChars ?? null,
      profileReadyForTailor: profileOk,
      pdfDownloadBaseName: profileOk
        ? resumePdfDownloadBaseName(p.firstName)
        : null,
    },
    {
      step: "GET_status",
      debugEnv: true,
    },
  );
  return NextResponse.json(body);
}

export async function POST(request: Request) {
  let routeKind: "prompt" | "tailor" | "unknown" = "unknown";
  let tailorCtx: Record<string, unknown> | null = null;

  try {
    if (process.env.DISABLE_VERTEX_TEST === "true") {
      return jsonError("AI test route is disabled", 404);
    }

    if (!isVertexEnvConfigured()) {
      return routeJsonError(
        "The AI connection (Google Cloud) is not set up. Add GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION to your .env file.",
        400,
        { step: "env_check", vertexConfigured: false },
      );
    }

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return routeJsonError("Expected JSON body", 400, {
        step: "read_json_body",
      });
    }

    const parsed = parsePostBody(json);
    if ("error" in parsed) {
      return routeJsonError(parsed.error, 400, { step: "parsePostBody" });
    }

    if (parsed.kind === "prompt") {
      routeKind = "prompt";
      const t0 = Date.now();
      const text = await generateVertexGeminiText(parsed.prompt);
      const body = attachTestVertexDebug(
        { text },
        {
          routeKind: "prompt",
          promptChars: parsed.prompt.length,
          vertexRoundTripMs: Date.now() - t0,
          outputChars: text.length,
        },
      );
      return NextResponse.json(body, { status: 200 });
    }

    routeKind = "tailor";
    const jd = parsed.jobDescription.trim();
    if (!jd) {
      return routeJsonError("Job posting text is empty after trimming.", 400, {
        step: "jd_trim",
        routeKind: "tailor",
      });
    }

    tailorCtx = { jdChars: jd.length };

    const tVertex = Date.now();
    let outText: string;
    let pdfDownloadBaseName: string;
    let truncated: boolean;
    try {
      const r = await tailorResumeMarkdown(jd);
      outText = r.markdown;
      pdfDownloadBaseName = r.pdfDownloadBaseName;
      truncated = r.wasTruncated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Tailor failed";
      const pre =
        err instanceof Error && err.name === "TailorPrerequisitesError";
      return routeJsonError(msg, pre ? 400 : 500, {
        step: "tailor_pipeline",
        routeKind: "tailor",
        jdChars: jd.length,
      });
    }

    tailorCtx = {
      ...tailorCtx,
      vertexMs: Date.now() - tVertex,
      outputChars: outText.length,
    };

    let atsHint: ReturnType<typeof computeAtsKeywordHint> = null;
    try {
      atsHint = computeAtsKeywordHint(jd, outText);
    } catch {
      atsHint = null;
    }

    const payload = attachTestVertexDebug(
      {
        mode: "tailor" as const,
        text: outText,
        atsHint,
        truncated,
        pdfDownloadBaseName,
      },
      {
        routeKind: "tailor",
        ...tailorCtx,
        responseChars: outText.length,
        atsHintPresent: atsHint !== null,
      },
    );

    try {
      return NextResponse.json(payload, { status: 200 });
    } catch {
      return routeJsonError(
        "The draft was too large to return. Try a shorter job posting or trim your saved resume, then run again.",
        500,
        { step: "serialize_json_response", ...tailorCtx },
      );
    }
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "AI request failed";
    if (isTestVertexApiDebug()) {
      return NextResponse.json(
        testVertexDebugErrorBody(message, e, {
          routeKind,
          ...(tailorCtx ?? {}),
        }),
        { status: 500 },
      );
    }
    return jsonError(message, 500);
  }
}
