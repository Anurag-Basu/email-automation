import "server-only";

import { z } from "zod";

import type { LeadCategory } from "@/lib/types";
import { generateVertexGeminiText, isVertexEnvConfigured } from "@/lib/vertex-genai";

const MAX_DESC_CHARS = 1800;
const DEFAULT_BATCH = 25;

const itemSchema = z.object({
  i: z.number().int().nonnegative(),
  c: z.enum(["frontend", "fullstack", "other"]),
});

const responseSchema = z.array(itemSchema);

function truncate(s: string): string {
  const t = s.trim();
  if (t.length <= MAX_DESC_CHARS) return t;
  return `${t.slice(0, MAX_DESC_CHARS)}…`;
}

function extractJsonArray(raw: string): unknown {
  let t = raw.trim();
  const fenced = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i.exec(t);
  if (fenced) t = fenced[1].trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return a JSON array");
  }
  return JSON.parse(t.slice(start, end + 1)) as unknown;
}

const INSTRUCTIONS = `You label job post snippets for recruiting (one label per item).

Categories (pick exactly one per index):
- "frontend": primarily front-end / UI work (e.g. React, Vue, CSS) without being clearly full-stack.
- "fullstack": full-stack role, or clearly both meaningful front-end and back-end engineering in the same role.
- "other": mobile-native, DevOps/SRE, data/ML, QA-only, pure backend-only, non-engineering, spam, empty noise, or anything that does not fit frontend/fullstack.

Output rules:
- Return ONLY a JSON array. No markdown fences, no commentary.
- One object per input line: {"i": <number>, "c": "frontend"|"fullstack"|"other"}
- The "i" field MUST be the index number shown before each post (same as in the list).
- Include every index exactly once. Lowercase "c" values only.`;

async function classifyOneBatch(
  slice: string[],
  globalOffset: number
): Promise<LeadCategory[]> {
  const lines = slice.map((text, j) => {
    const idx = globalOffset + j;
    const safe = text.replace(/```/g, "'''");
    return `${idx}: ${truncate(safe)}`;
  });

  const user = `${INSTRUCTIONS}

Posts:
${lines.join("\n\n")}

Respond with a JSON array only, e.g. [{"i":${globalOffset},"c":"frontend"},...]`;

  const run = async () => {
    const raw = await generateVertexGeminiText(user);
    const parsed = responseSchema.safeParse(extractJsonArray(raw));
    if (!parsed.success) {
      throw new Error(`Invalid classification JSON: ${parsed.error.message}`);
    }
    const arr = parsed.data.sort((a, b) => a.i - b.i);
    const expected = new Set(
      slice.map((_, j) => globalOffset + j)
    );
    const got = new Set(arr.map((x) => x.i));
    if (got.size !== expected.size || [...expected].some((i) => !got.has(i))) {
      throw new Error(
        "Model omitted or duplicated indices; expected one entry per post index."
      );
    }
    const byI = new Map(arr.map((x) => [x.i, x.c]));
    return slice.map((_, j) => byI.get(globalOffset + j)!);
  };

  try {
    return await run();
  } catch {
    const raw = await generateVertexGeminiText(
      `${user}\n\nYour previous answer was invalid or incomplete. Reply with ONLY one JSON array, one object per index ${globalOffset}..${globalOffset + slice.length - 1}, fields i and c only.`
    );
    const parsed = responseSchema.safeParse(extractJsonArray(raw));
    if (!parsed.success) {
      throw new Error(
        `Vertex classification failed after retry: ${parsed.error.message}`
      );
    }
    const arr = parsed.data;
    const byI = new Map<number, LeadCategory>();
    for (const x of arr) {
      if (x.i >= globalOffset && x.i < globalOffset + slice.length) {
        byI.set(x.i, x.c);
      }
    }
    return slice.map((_, j) => byI.get(globalOffset + j) ?? "other");
  }
}

function batchSize(): number {
  const n = Number(process.env.CLASSIFY_VERTEX_BATCH_SIZE);
  if (Number.isFinite(n) && n >= 1 && n <= 80) return Math.floor(n);
  return DEFAULT_BATCH;
}

/**
 * Classify each job snippet with Vertex Gemini only (batched). Requires Vertex env.
 * Empty descriptions are labeled "other" without an API call.
 */
export async function classifyDescriptionsWithVertex(
  descriptions: string[]
): Promise<LeadCategory[]> {
  if (!isVertexEnvConfigured()) {
    throw new Error(
      "The AI connection (Google Cloud) is not set up. Add GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, and your service-account credentials so imports can be sorted by role."
    );
  }

  const out: LeadCategory[] = Array.from(
    { length: descriptions.length },
    () => "other" as LeadCategory
  );
  const work: { idx: number; text: string }[] = [];
  descriptions.forEach((d, idx) => {
    if (d.trim()) work.push({ idx, text: d });
  });
  if (!work.length) return out;

  const bs = batchSize();
  for (let w = 0; w < work.length; w += bs) {
    const chunk = work.slice(w, w + bs);
    const texts = chunk.map((c) => c.text);
    const globalOffset = chunk[0].idx;
    const categories = await classifyOneBatch(texts, globalOffset);
    chunk.forEach((c, j) => {
      out[c.idx] = categories[j] ?? "other";
    });
  }

  return out;
}
