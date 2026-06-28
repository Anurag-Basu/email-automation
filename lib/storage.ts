import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Lead, LeadCategory, LeadsFile } from "@/lib/types";
import { DATA_DIR, LEADS_FILE } from "@/lib/paths";

const emptyState: LeadsFile = { leads: [], nextId: 1 };

let queue = Promise.resolve();

function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readState(): Promise<LeadsFile> {
  try {
    const raw = await readFile(LEADS_FILE, "utf8");
    const parsed = JSON.parse(raw) as LeadsFile;
    if (!Array.isArray(parsed.leads) || typeof parsed.nextId !== "number") {
      return { ...emptyState };
    }
    return parsed;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return { ...emptyState };
    throw e;
  }
}

async function writeStateAtomic(state: LeadsFile) {
  await ensureDataDir();
  const tmp = path.join(DATA_DIR, `leads.${Date.now()}.tmp.json`);
  await writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
  await rename(tmp, LEADS_FILE);
}

export async function getLeads(): Promise<Lead[]> {
  const state = await readState();
  return state.leads;
}

export async function importLeads(
  rows: Array<Pick<Lead, "author" | "email" | "description" | "category">>
): Promise<Lead[]> {
  return runExclusive(async () => {
    const state = await readState();
    let id = state.nextId;
    const leads: Lead[] = rows.map((row) => ({
      id: id++,
      author: row.author,
      email: row.email,
      description: row.description,
      category: row.category,
      status: "pending" as const,
    }));
    await writeStateAtomic({ leads, nextId: id });
    return leads;
  });
}

export type SendResult = {
  id: number;
  ok: boolean;
  error?: string;
  /** True when this row was not emailed because another lead with the same address was already sent (or sent earlier in this run). */
  duplicateSkip?: boolean;
};

function normalizeLeadEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type ProcessPendingOptions = {
  /** When set, only leads in this category are processed (e.g. active dashboard tab). */
  category?: LeadCategory;
  /** Max tailor+send calls per run; duplicate-address skips do not count. Omit = entire queue. */
  maxSendAttempts?: number;
};

export async function processPendingSends(
  sendOne: (lead: Lead) => Promise<void>,
  options?: ProcessPendingOptions,
): Promise<{ results: SendResult[]; morePending: boolean }> {
  return runExclusive(async () => {
    const state = await readState();
    const results: SendResult[] = [];
    let candidates = state.leads.filter(
      (l) => l.status === "pending" || l.status === "failed",
    );
    if (options?.category) {
      candidates = candidates.filter((l) => l.category === options.category);
    }
    candidates.sort((a, b) => a.id - b.id);

    const byId = new Map(state.leads.map((l) => [l.id, { ...l }]));

    /** Addresses that already received an email (from earlier sends or earlier in this batch). */
    const alreadyEmailed = new Set(
      state.leads
        .filter((l) => l.status === "sent")
        .map((l) => normalizeLeadEmail(l.email))
        .filter(Boolean),
    );

    let sendAttempts = 0;
    const maxSend = options?.maxSendAttempts;

    for (const lead of candidates) {
      const current = byId.get(lead.id);
      if (
        !current ||
        (current.status !== "pending" && current.status !== "failed")
      ) {
        continue;
      }

      const addr = normalizeLeadEmail(current.email);
      if (addr && alreadyEmailed.has(addr)) {
        current.status = "sent";
        delete current.lastError;
        results.push({ id: current.id, ok: true, duplicateSkip: true });
        await writeStateAtomic({
          leads: [...byId.values()].sort((a, b) => a.id - b.id),
          nextId: state.nextId,
        });
        continue;
      }

      if (maxSend != null && sendAttempts >= maxSend) {
        break;
      }

      try {
        await sendOne(current);
        sendAttempts++;
        current.status = "sent";
        delete current.lastError;
        if (addr) alreadyEmailed.add(addr);
        results.push({ id: current.id, ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        current.status = "failed";
        current.lastError = message;
        results.push({ id: current.id, ok: false, error: message });
      }

      await writeStateAtomic({
        leads: [...byId.values()].sort((a, b) => a.id - b.id),
        nextId: state.nextId,
      });
    }

    const cat = options?.category;
    const morePending = [...byId.values()].some(
      (l) =>
        (l.status === "pending" || l.status === "failed") &&
        (!cat || l.category === cat),
    );

    return { results, morePending };
  });
}
