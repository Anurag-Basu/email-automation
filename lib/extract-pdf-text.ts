import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import "server-only";

import { ensurePdfjsNodePolyfill } from "@/lib/pdfjs-node-polyfill";

/** `require.resolve` can return a numeric webpack/turbopack module id in some bundles — never pass that to `path.*`. */
function resolvePdfWorkerFilePath(): string {
  const require = createRequire(import.meta.url);
  const attempts: string[] = [];

  try {
    const resolved = require.resolve("pdfjs-dist/legacy/build/pdf.mjs");
    if (typeof resolved === "string" && resolved.length > 0 && /[\\/]/.test(resolved)) {
      attempts.push(
        path.join(path.dirname(resolved), "pdf.worker.mjs")
      );
    }
  } catch {
    /* try cwd fallbacks */
  }

  const cwd = String(process.cwd());
  for (const root of [
    cwd,
    path.join(cwd, ".next", "standalone"),
    /** Docker `standalone` often sets `WORKDIR /app`; worker lives next to server. */
    path.join(cwd, ".."),
  ]) {
    attempts.push(
      path.join(
        root,
        "node_modules",
        "pdfjs-dist",
        "legacy",
        "build",
        "pdf.worker.mjs"
      )
    );
  }

  for (const p of attempts) {
    if (existsSync(p)) return p;
  }

  throw new Error(
    `pdfjs-dist worker not found (checked ${attempts.length} paths). Reinstall pdfjs-dist or verify Next standalone copied node_modules.`
  );
}

function resolvePdfWorkerFileUrl(): string {
  return pathToFileURL(resolvePdfWorkerFilePath()).href;
}

/** Extract plain text from a PDF buffer (server / Node only). Uses pdfjs with an explicit worker file URL. */
export async function extractPlainTextFromPdfBuffer(
  buffer: Buffer
): Promise<string> {
  await ensurePdfjsNodePolyfill();

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = resolvePdfWorkerFileUrl();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
  });

  const pdf = await loadingTask.promise;
  try {
    const chunks: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if (item && typeof item === "object" && "str" in item) {
          const s = (item as { str: string }).str;
          if (s) chunks.push(s);
        }
      }
      await page.cleanup();
    }
    return chunks.join(" ").replace(/\s+/g, " ").trim();
  } finally {
    await pdf.destroy();
  }
}
