import { truncateForApiMessage } from "@/lib/http";

/** When true, `/api/test-vertex` adds a `debug` object to JSON (no full JD/resume). */
export function isTestVertexApiDebug(): boolean {
  const v = process.env.DEBUG_TEST_VERTEX?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

export function attachTestVertexDebug<T extends Record<string, unknown>>(
  body: T,
  debug: Record<string, unknown>
): T & { debug?: Record<string, unknown> } {
  if (!isTestVertexApiDebug()) return body;
  return {
    ...body,
    debug: {
      ts: new Date().toISOString(),
      ...debug,
    },
  };
}

export function testVertexDebugErrorBody(
  message: string,
  err: unknown,
  extra: Record<string, unknown>
): { error: string; debug: Record<string, unknown> } {
  const e = err instanceof Error ? err : null;
  const status =
    err &&
    typeof err === "object" &&
    "status" in err &&
    typeof (err as { status: unknown }).status === "number"
      ? (err as { status: number }).status
      : undefined;

  return {
    error: truncateForApiMessage(message, 6000),
    debug: {
      ts: new Date().toISOString(),
      ...extra,
      errName: e?.name ?? typeof err,
      errMessagePreview: e?.message
        ? truncateForApiMessage(e.message, 8000)
        : truncateForApiMessage(String(err), 2000),
      clientHttpStatus: status,
    },
  };
}
