import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Lead, LeadsFile } from "@/lib/types";
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
  rows: Omit<Lead, "id" | "category" | "status">[],
  classify: (description: string) => Lead["category"]
): Promise<Lead[]> {
  return runExclusive(async () => {
    const state = await readState();
    let id = state.nextId;
    const leads: Lead[] = rows.map((row) => ({
      id: id++,
      author: row.author,
      email: row.email,
      description: row.description,
      category: classify(row.description),
      status: "pending" as const,
    }));
    await writeStateAtomic({ leads, nextId: id });
    return leads;
  });
}

export type SendResult = { id: number; ok: boolean; error?: string };

export async function processPendingSends(
  sendOne: (lead: Lead) => Promise<void>
): Promise<SendResult[]> {
  return runExclusive(async () => {
    const state = await readState();
    const results: SendResult[] = [];
    const pending = state.leads.filter((l) => l.status === "pending");
    const byId = new Map(state.leads.map((l) => [l.id, { ...l }]));

    for (const lead of pending) {
      const current = byId.get(lead.id);
      if (!current || current.status !== "pending") continue;
      try {
        await sendOne(current);
        current.status = "sent";
        delete current.lastError;
        results.push({ id: current.id, ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        current.status = "failed";
        current.lastError = message;
        results.push({ id: current.id, ok: false, error: message });
      }
    }

    await writeStateAtomic({
      leads: [...byId.values()].sort((a, b) => a.id - b.id),
      nextId: state.nextId,
    });
    return results;
  });
}
