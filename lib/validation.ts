import { z } from "zod";

import { parseLeadCategoryFromCsvCell } from "@/lib/category-from-csv";
import type { ParsedRow } from "@/lib/csv";
import { sanitizeLeadFields } from "@/lib/sanitize";
import type { LeadCategory } from "@/lib/types";

const rowSchema = z.object({
  author: z.string().max(500),
  email: z.email(),
  description: z.string().max(5000),
});

export type ValidatedRow = z.infer<typeof rowSchema> & {
  /** Parsed from optional Category/Label column; null → classify with AI */
  csvCategory: LeadCategory | null;
};

export type SkippedRow = { line: number; reason: string };

/** After validation: one row per email (first row wins). */
export function dedupeValidatedRowsByEmail(
  rows: ValidatedRow[]
): { rows: ValidatedRow[]; dropped: number } {
  const seen = new Set<string>();
  const out: ValidatedRow[] = [];
  for (const r of rows) {
    const key = r.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return { rows: out, dropped: rows.length - out.length };
}

/**
 * Clean LinkedIn / messy scrape rows, then validate.
 * Rows without a recoverable valid email are skipped (not fatal for the whole file).
 */
export function prepareLeadRowsForImport(rows: ParsedRow[]): {
  valid: ValidatedRow[];
  skipped: SkippedRow[];
  duplicateEmailsDropped: number;
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
    const csvCategory = parseLeadCategoryFromCsvCell(row.categoryFromCsv);
    valid.push({ ...r.data, csvCategory });
  });

  const { rows: deduped, dropped } = dedupeValidatedRowsByEmail(valid);
  return { valid: deduped, skipped, duplicateEmailsDropped: dropped };
}
