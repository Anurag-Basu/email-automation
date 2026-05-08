import { z } from "zod";

import { sanitizeLeadFields } from "@/lib/sanitize";
import type { ParsedRow } from "@/lib/csv";

const rowSchema = z.object({
  author: z.string().max(500),
  email: z.email(),
  description: z.string().max(5000),
});

export type ValidatedRow = z.infer<typeof rowSchema>;

export type SkippedRow = { line: number; reason: string };

/**
 * Clean LinkedIn / messy scrape rows, then validate.
 * Rows without a recoverable valid email are skipped (not fatal for the whole file).
 */
export function prepareLeadRowsForImport(rows: ParsedRow[]): {
  valid: ValidatedRow[];
  skipped: SkippedRow[];
} {
  const valid: ValidatedRow[] = [];
  const skipped: SkippedRow[] = [];

  rows.forEach((row, i) => {
    const line = i + 2;
    const cleaned = sanitizeLeadFields(row);
    const r = rowSchema.safeParse(cleaned);
    if (!r.success) {
      const msg = r.error.issues.map((iss) => iss.message).join("; ");
      skipped.push({
        line,
        reason:
          cleaned.email.length === 0
            ? "No valid email (empty contact field and none found in post text)"
            : msg,
      });
      return;
    }
    valid.push(r.data);
  });

  return { valid, skipped };
}
