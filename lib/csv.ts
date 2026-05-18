import { parse } from "csv-parse/sync";

const MAX_BYTES = 50 * 1024 * 1024;

export type ParsedRow = {
  author: string;
  email: string;
  description: string;
  /** First non-empty Category / Label / Tab-style column (see LIB/category-from-csv). */
  categoryFromCsv: string;
};

function normalizeHeader(key: string) {
  return key.trim().toLowerCase().replace(/\s+/g, "_");
}

function mapRow(row: Record<string, string>): ParsedRow {
  const m: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    m[normalizeHeader(k)] = String(v ?? "").trim();
  }
  const author =
    m.author ||
    m.name ||
    m.full_name ||
    m.poster ||
    m.profile_name ||
    "";
  const email =
    m.email ||
    m.mail ||
    m.e_mail ||
    m.emails_found ||
    m.emails ||
    m.contact_email ||
    "";
  const description =
    m.description ||
    m.role ||
    m.title ||
    m.summary ||
    m.profile ||
    m.post_snippet ||
    m.snippet ||
    m.post ||
    "";

  const categoryFromCsv =
    m.category ||
    m.label ||
    m.tab ||
    m.lead_category ||
    m.contact_category ||
    m.job_category ||
    "";

  return { author, email, description, categoryFromCsv };
}

export function parseLeadCsv(buffer: Buffer): ParsedRow[] {
  if (buffer.length > MAX_BYTES) {
    throw new Error(`CSV exceeds maximum size of ${MAX_BYTES / (1024 * 1024)} MB`);
  }
  const text = buffer.toString("utf8");
  let records: Record<string, string>[];
  try {
    records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as Record<string, string>[];
  } catch {
    throw new Error("Invalid CSV format");
  }

  if (!records.length) {
    throw new Error("CSV has no data rows");
  }

  return records.map(mapRow);
}
