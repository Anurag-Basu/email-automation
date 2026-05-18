import path from "node:path";

function envPathOrEmpty(key: string): string {
  const v = process.env[key];
  if (v == null) return "";
  const s = String(v).trim();
  return s;
}

/**
 * Lead JSON storage directory.
 *
 * Default: `<cwd>/.data` (works when you run `npm run dev` from this repo).
 *
 * Set `LEADS_DATA_DIR` to an absolute path **outside** this repo if your machine
 * is sensitive to many writes under the project tree during development
 * (e.g. `/tmp/email-automation-data` on macOS/Linux).
 */
const cwd = () => String(process.cwd());
const leadsDataDir = envPathOrEmpty("LEADS_DATA_DIR");

export const DATA_DIR = leadsDataDir
  ? path.resolve(leadsDataDir)
  : path.join(cwd(), ".data");

export const LEADS_FILE = path.join(DATA_DIR, "leads.json");
