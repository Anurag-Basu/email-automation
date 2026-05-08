import path from "node:path";

/**
 * Lead JSON storage directory.
 *
 * Default: `<cwd>/.data` (works when you run `npm run dev` from this repo).
 *
 * Set `LEADS_DATA_DIR` to an absolute path **outside** this repo if your machine
 * is sensitive to many writes under the project tree during development
 * (e.g. `/tmp/email-automation-data` on macOS/Linux).
 */
export const DATA_DIR = process.env.LEADS_DATA_DIR?.trim()
  ? path.resolve(process.env.LEADS_DATA_DIR.trim())
  : path.join(process.cwd(), ".data");

export const LEADS_FILE = path.join(DATA_DIR, "leads.json");
