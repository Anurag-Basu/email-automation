import type { LeadCategory } from "@/lib/types";

/**
 * Optional spreadsheet column for tab/role (saves AI classification when every row has a valid value).
 *
 * **Headers** (case-insensitive; spaces → underscores): `Category`, `Label`, `Tab`,
 * `Lead category`, `Contact category`, `Job category`.
 *
 * **Cell values** (spacing/hyphens/underscores ignored, case-insensitive):
 * - `frontend` — also `fe`, `front end`
 * - `fullstack` — also `full-stack`, `full_stack`, `fs`
 * - `other` — also `others`
 *
 * Empty or unknown values → that row is sorted with AI (partial imports only call AI for those rows).
 * If **every** row has a valid value, the import skips AI entirely (no Google Cloud needed for sorting).
 */
export const CSV_ROLE_COLUMN_NAMES =
  "Category, Label, Tab, Lead category, Contact category, or Job category";

function compactKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export function parseLeadCategoryFromCsvCell(raw: string): LeadCategory | null {
  const c = compactKey(raw);
  if (!c) return null;
  if (c === "frontend" || c === "fe") return "frontend";
  if (c === "fullstack" || c === "fs") return "fullstack";
  if (c === "other" || c === "others") return "other";
  return null;
}
