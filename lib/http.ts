import { NextResponse } from "next/server";

/** Avoid huge `Error.message` / API bodies blowing up `JSON.stringify` or client payloads. */
export function truncateForApiMessage(s: string, max = 4000): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}… [truncated]`;
}

export function jsonError(
  message: string,
  status: number,
  details?: unknown
): NextResponse {
  const safeMessage = truncateForApiMessage(message);
  let safeDetails: unknown = details;
  if (details !== undefined) {
    if (typeof details === "string") {
      safeDetails = truncateForApiMessage(details);
    } else {
      try {
        const ser = JSON.stringify(details);
        if (ser.length > 8000) safeDetails = truncateForApiMessage(ser);
      } catch {
        safeDetails = "[unserializable details]";
      }
    }
  }
  return NextResponse.json(
    {
      error: safeMessage,
      ...(details !== undefined ? { details: safeDetails } : {}),
    },
    { status }
  );
}
