import "server-only";

/**
 * pdfjs-dist expects browser globals (e.g. DOMMatrix). In Node / Docker they are
 * missing unless we attach implementations from `@napi-rs/canvas` before loading pdfjs.
 */
let polyfillPromise: Promise<void> | null = null;

export function ensurePdfjsNodePolyfill(): Promise<void> {
  if (typeof globalThis.DOMMatrix === "function") {
    return Promise.resolve();
  }
  if (!polyfillPromise) {
    polyfillPromise = (async () => {
      const napi = await import("@napi-rs/canvas");
      const g = globalThis as unknown as Record<string, unknown>;
      if (typeof g.DOMMatrix === "undefined") g.DOMMatrix = napi.DOMMatrix;
      if (typeof g.ImageData === "undefined") g.ImageData = napi.ImageData;
      if (typeof g.Path2D === "undefined") g.Path2D = napi.Path2D;
    })();
  }
  return polyfillPromise;
}
