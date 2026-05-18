import "server-only";

import { GoogleGenAI } from "@google/genai";

/** Default for `enterprise: true` (Gemini Enterprise / Agent Platform). Override with `VERTEX_GEMINI_MODEL`. */
export const DEFAULT_VERTEX_GEMINI_MODEL = "gemini-2.5-flash";

function requireVertexEnv(): {
  project: string;
  location: string;
  model: string;
} {
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const location = process.env.GOOGLE_CLOUD_LOCATION?.trim();
  if (!project || !location) {
    throw new Error(
      "Add GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION to your .env file. For Gemini Enterprise, Google often uses `global` as the location; older guides may say `us-central1`.",
    );
  }
  const model =
    process.env.VERTEX_GEMINI_MODEL?.trim() || DEFAULT_VERTEX_GEMINI_MODEL;
  return { project, location, model };
}

/** Vertex / Gemini Enterprise (Agent Platform) client using ADC or GOOGLE_APPLICATION_CREDENTIALS. */
export function createVertexGenAI(): GoogleGenAI {
  const { project, location } = requireVertexEnv();
  return new GoogleGenAI({
    enterprise: true,
    project,
    location,
    apiVersion: "v1",
  });
}

export async function generateVertexGeminiText(
  prompt: string,
): Promise<string> {
  const { model } = requireVertexEnv();
  const ai = createVertexGenAI();
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });
  const text = response.text;
  if (text !== undefined && text !== "") {
    return text;
  }

  const blockReason = response.promptFeedback?.blockReason;
  const blockMsg = response.promptFeedback?.blockReasonMessage;
  const finishReason = response.candidates?.[0]?.finishReason;
  const finishMessage = response.candidates?.[0]?.finishMessage;
  const parts = response.candidates?.[0]?.content?.parts;

  const hintParts: string[] = [];
  if (blockReason != null) {
    hintParts.push(
      `prompt blocked (${String(blockReason)}${blockMsg ? `: ${blockMsg}` : ""})`,
    );
  }
  if (finishReason != null) {
    hintParts.push(
      `finishReason=${String(finishReason)}${finishMessage ? ` (${finishMessage})` : ""}`,
    );
  }
  if (!parts?.length) {
    hintParts.push("no candidate text parts");
  }

  throw new Error(
    hintParts.length
      ? `Empty AI response — ${hintParts.join("; ")}. Try a shorter job posting or resume, different wording, or another model (VERTEX_GEMINI_MODEL).`
      : "Empty AI response. Check VERTEX_GEMINI_MODEL, region availability, or safety blocks."
  );
}

export function isVertexEnvConfigured(): boolean {
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const location = process.env.GOOGLE_CLOUD_LOCATION?.trim();
  return Boolean(project && location);
}
