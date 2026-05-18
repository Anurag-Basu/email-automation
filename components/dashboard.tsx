"use client";

import {
  Loader2,
  Mail,
  RefreshCw,
  Upload,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { LeadsTable } from "@/components/leads-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CSV_ROLE_COLUMN_NAMES } from "@/lib/category-from-csv";
import { cn } from "@/lib/utils";
import type { Lead, LeadCategory } from "@/lib/types";

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text.slice(0, 200) || "Unexpected response from server");
  }
}

type LeadTab = "all" | LeadCategory;

const LEAD_TABS: { id: LeadTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "frontend", label: "Frontend" },
  { id: "fullstack", label: "Full-stack" },
  { id: "other", label: "Other" },
];

export function Dashboard({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [leadTab, setLeadTab] = useState<LeadTab>("all");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<string[]>([]);
  const [importSkipped, setImportSkipped] = useState<string[]>([]);
  const [pendingCsv, setPendingCsv] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [sendReady, setSendReady] = useState<{
    vertex: boolean;
    resume: boolean;
    profile: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/test-vertex", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setSendReady(null);
          return;
        }
        const j = (await res.json()) as {
          vertexEnvConfigured?: boolean;
          hasResume?: boolean;
          profileReadyForTailor?: boolean;
        };
        if (!cancelled) {
          setSendReady({
            vertex: Boolean(j.vertexEnvConfigured),
            resume: Boolean(j.hasResume),
            profile: Boolean(j.profileReadyForTailor),
          });
        }
      } catch {
        if (!cancelled) setSendReady(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRowErrors([]);
    setImportSkipped([]);
    try {
      const res = await fetch("/api/leads", { cache: "no-store" });
      const data = await readJson<{ leads: Lead[]; error?: string }>(res);
      if (!res.ok) {
        throw new Error(data.error || "Failed to load leads");
      }
      setLeads(data.leads);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load leads";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const onImportCsv = async (file: File) => {
    setUploading(true);
    setError(null);
    setRowErrors([]);
    setImportSkipped([]);
    const form = new FormData();
    form.set("file", file);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });
      const data = await readJson<{
        ok?: boolean;
        count?: number;
        error?: string;
        rowErrors?: string[];
        skippedCount?: number;
        duplicateEmailsDropped?: number;
        categories?: { frontend: number; fullstack: number; other: number };
        skipped?: { line: number; reason: string }[];
        skippedTruncated?: boolean;
        usedAiForCategories?: boolean;
      }>(res);

      if (!res.ok) {
        if (data.rowErrors?.length) {
          setRowErrors(data.rowErrors);
        }
        throw new Error(data.error || "Upload failed");
      }

      const skipped = data.skippedCount ?? 0;
      const dup = data.duplicateEmailsDropped ?? 0;
      const cat = data.categories;
      if (skipped > 0 && data.skipped?.length) {
        const lines = data.skipped.map((s) => `Row ${s.line}: ${s.reason}`);
        if (data.skippedTruncated) {
          lines.push(
            `…and more rows were skipped (total skipped: ${skipped}).`
          );
        }
        setImportSkipped(lines);
      }
      const parts = [`Imported ${data.count ?? 0} contacts`];
      if (dup > 0) parts.push(`${dup} duplicate inbox removed`);
      if (skipped > 0) parts.push(`${skipped} row(s) skipped (no email)`);
      if (cat) {
        parts.push(
          `Sorted: ${cat.frontend} frontend · ${cat.fullstack} full-stack · ${cat.other} other`
        );
      }
      if (data.usedAiForCategories === false) {
        parts.push("Tabs from your file (AI skipped)");
      } else if (data.usedAiForCategories === true) {
        parts.push("Some or all tabs from AI");
      }
      toast.success(parts.join(" · "));
      setPendingCsv(null);
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const pendingCount = leads.filter((l) => l.status === "pending").length;
  const sentCount = leads.filter((l) => l.status === "sent").length;
  const failedCount = leads.filter((l) => l.status === "failed").length;

  const filteredLeads = useMemo(() => {
    if (leadTab === "all") return leads;
    return leads.filter((l) => l.category === leadTab);
  }, [leads, leadTab]);

  const queueInScope = useMemo(() => {
    let base = leads.filter(
      (l) => l.status === "pending" || l.status === "failed",
    );
    if (leadTab !== "all") {
      base = base.filter((l) => l.category === leadTab);
    }
    return base;
  }, [leads, leadTab]);

  const countsByCategory = useMemo(() => {
    return leads.reduce(
      (acc, l) => {
        acc[l.category]++;
        return acc;
      },
      { frontend: 0, fullstack: 0, other: 0 },
    );
  }, [leads]);

  const sendEmails = async () => {
    setSending(true);
    setError(null);
    setRowErrors([]);
    setImportSkipped([]);
    const n = queueInScope.length;
    if (!n) {
      toast.message(
        "Nobody left to email in this view — pick another tab or import more contacts."
      );
      setSending(false);
      return;
    }
    const scopeLabel =
      leadTab === "all"
        ? "all categories"
        : `${LEAD_TABS.find((t) => t.id === leadTab)?.label ?? leadTab} tab`;
    const toastId = toast.loading(
      `Updating resumes and sending ${n} email(s) (${scopeLabel})…`,
    );
    try {
      const res = await fetch("/api/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadTab === "all" ? {} : { category: leadTab }),
      });
      const data = await readJson<{
        ok?: boolean;
        error?: string;
        sent?: number;
        failed?: number;
        skippedDuplicates?: number;
        processed?: number;
      }>(res);
      if (!res.ok) {
        throw new Error(data.error || "Send failed");
      }
      const skip = data.skippedDuplicates ?? 0;
      const tail =
        skip > 0
          ? ` · ${skip} skipped (same email already sent earlier)`
          : "";
      toast.success(`Done: ${data.sent ?? 0} sent · ${data.failed ?? 0} not sent${tail}`, {
        id: toastId,
      });
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Send failed";
      toast.error(msg, { id: toastId });
      setError(msg);
    } finally {
      setSending(false);
      try {
        const r = await fetch("/api/test-vertex", { cache: "no-store" });
        if (r.ok) {
          const j = (await r.json()) as {
            vertexEnvConfigured?: boolean;
            hasResume?: boolean;
            profileReadyForTailor?: boolean;
          };
          setSendReady({
            vertex: Boolean(j.vertexEnvConfigured),
            resume: Boolean(j.hasResume),
            profile: Boolean(j.profileReadyForTailor),
          });
        }
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
      <header className="flex min-w-0 flex-col gap-4 sm:gap-5">
        <div className="space-y-2 sm:space-y-3">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Your outreach workspace
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Reach out from a contact list
          </h1>
        </div>
        <p className="w-full max-w-none text-pretty text-sm leading-relaxed text-muted-foreground lg:text-base lg:leading-relaxed">
          <strong>1.</strong> Pick a spreadsheet export (
          <code className="text-xs">.csv</code> from Excel, Google Sheets,
          etc.).           <strong>2.</strong> Tap <strong>Import &amp; clean</strong> to tidy
          messy cells and duplicate addresses. If your sheet has a{" "}
          <strong>{CSV_ROLE_COLUMN_NAMES}</strong> column and each row contains
          one of{" "}
          <code className="text-xs">frontend</code>,{" "}
          <code className="text-xs">fullstack</code>,{" "}
          <code className="text-xs">other</code> (or{" "}
          <code className="text-xs">others</code>), those tabs are used and AI
          sorting is skipped for that row — if <em>every</em> row is labeled,
          no AI is needed for import. Otherwise the app uses AI to sort into
          tabs. <strong>3.</strong> When you tap{" "}
          <strong>Send emails</strong>, the app drafts a resume version tuned to
          that person&apos;s post, saves it as{" "}
          <code className="text-xs">FirstName_resume.pdf</code>, and sends your
          message through your outgoing mail settings (the same “SMTP” options
          in{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">.env</code>
          ). After each send, progress is saved so you can stop and continue
          later (anything still <em>waiting</em> or <em>failed</em> stays in the
          queue). For a trial run without real delivery, turn on practice mode
          with{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            SMTP_DRY_RUN=true
          </code>
          . On a large screen, use <strong>Try features</strong> and{" "}
          <strong>Settings</strong> in the header to finish setup.
        </p>
        <div className="flex w-full min-w-0 flex-col items-end gap-2">
          <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="Choose CSV spreadsheet with your contacts"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setPendingCsv(f ?? null);
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={uploading || sending}
              onClick={() => fileRef.current?.click()}
            >
              <Upload aria-hidden />
              Choose CSV
            </Button>
            <Button
              type="button"
              className="shrink-0"
              disabled={
                uploading || sending || !pendingCsv || pendingCsv.size === 0
              }
              onClick={() => {
                if (pendingCsv) void onImportCsv(pendingCsv);
              }}
            >
              {uploading ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : null}
              Import &amp; clean
            </Button>
            <Button
              type="button"
              className="shrink-0"
              disabled={sending || uploading || queueInScope.length === 0}
              onClick={() => void sendEmails()}
            >
              {sending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Mail aria-hidden />
              )}
              Send emails
              <span className="ml-1 text-xs font-normal opacity-90">
                (
                {queueInScope.length}
                {leadTab === "all" ? " in queue" : " in this tab"})
              </span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="shrink-0"
              disabled={loading || uploading || sending}
              onClick={() => void refresh()}
              aria-label="Refresh list"
            >
              <RefreshCw
                className={loading ? "animate-spin" : ""}
                aria-hidden
              />
            </Button>
          </div>
          {pendingCsv ? (
            <p className="max-w-full text-right text-xs text-muted-foreground">
              Selected:{" "}
              <span className="font-medium text-foreground">
                {pendingCsv.name}
              </span>
              {" · "}
              <button
                type="button"
                className="text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  setPendingCsv(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                Clear
              </button>
            </p>
          ) : null}
        </div>
      </header>

      {sendReady &&
      (!sendReady.vertex || !sendReady.resume || !sendReady.profile) ? (
        <Alert>
          <AlertTitle>Finish setup before sending</AlertTitle>
          <AlertDescription>
            To send, you need the AI connection configured, an uploaded resume,
            and your name filled in under Settings (first name sets the PDF
            file name). Open{" "}
            <a
              href="/admin"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Settings
            </a>{" "}
            and{" "}
            <a
              href="/test"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Try features
            </a>{" "}
            to double-check. Still missing:{" "}
            {[
              !sendReady.vertex ? "AI / Google Cloud settings" : null,
              !sendReady.resume ? "saved resume file" : null,
              !sendReady.profile ? "your name in profile" : null,
            ]
              .filter(Boolean)
              .join(", ")}
            .
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {rowErrors.length ? (
        <Alert variant="destructive">
          <AlertTitle>Spreadsheet check</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 max-h-48 list-inside list-disc space-y-1 overflow-y-auto text-left">
              {rowErrors.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {importSkipped.length ? (
        <Alert>
          <AlertTitle>Rows skipped (no valid email after cleanup)</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 max-h-48 list-inside list-disc space-y-1 overflow-y-auto text-left text-muted-foreground">
              {importSkipped.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4 shrink-0" aria-hidden />
              <span>Total contacts</span>
            </div>
            <CardTitle className="text-2xl tabular-nums">
              {loading ? "—" : leads.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Waiting to send</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-amber-700 dark:text-amber-400">
              {loading ? "—" : pendingCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sent / didn&apos;t go through</CardDescription>
            <CardTitle className="flex flex-wrap items-baseline gap-2 text-2xl">
              <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
                {loading ? "—" : sentCount}
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="tabular-nums text-destructive">
                {loading ? "—" : failedCount}
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/30">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Contacts</CardTitle>
              <CardDescription>
                Typical columns: who posted, their email, and a short job blurb.
                Optional: {CSV_ROLE_COLUMN_NAMES} with values{" "}
                <code className="text-[11px]">frontend</code> /{" "}
                <code className="text-[11px]">fullstack</code> /{" "}
                <code className="text-[11px]">other</code> to choose tabs without
                AI. After <strong>Import &amp; clean</strong>, you get one row
                per inbox. Rows without a working email are skipped.
              </CardDescription>
            </div>
            {!loading && leads.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{pendingCount} waiting</Badge>
                <Badge variant="success">{sentCount} sent</Badge>
                {failedCount > 0 ? (
                  <Badge variant="destructive">{failedCount} not sent</Badge>
                ) : null}
              </div>
            ) : null}
          </div>
        </CardHeader>
        <div
          role="tablist"
          aria-label="Filter contacts by role type"
          className="flex flex-wrap gap-1 border-b border-border bg-muted/20 px-4 py-2 sm:px-6"
        >
          {LEAD_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              {...(leadTab === t.id
                ? { "aria-selected": true as const }
                : { "aria-selected": false as const })}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                leadTab === t.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setLeadTab(t.id)}
            >
              {t.label}
              {t.id !== "all" ? (
                <span className="ml-1 tabular-nums text-xs text-muted-foreground">
                  (
                  {t.id === "frontend"
                    ? countsByCategory.frontend
                    : t.id === "fullstack"
                      ? countsByCategory.fullstack
                      : countsByCategory.other}
                  )
                </span>
              ) : (
                <span className="ml-1 tabular-nums text-xs text-muted-foreground">
                  ({leads.length})
                </span>
              )}
            </button>
          ))}
        </div>
        <CardContent className="p-0 sm:p-0">
          {loading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" aria-hidden />
              Loading…
            </div>
          ) : (
            <div className="flex flex-col gap-1 p-4 sm:p-6">
              <p className="text-xs text-muted-foreground">
                Showing{" "}
                <span className="font-medium text-foreground">
                  {filteredLeads.length}
                </span>
                {leadTab !== "all" ? (
                  <>
                    {" "}
                    of {leads.length} total
                  </>
                ) : null}{" "}
                · <strong>Send emails</strong> only contacts people in the tab
                you&apos;re viewing who are still <em>waiting</em> or{" "}
                <em>didn&apos;t go through</em> (oldest first). Choose{" "}
                <strong>All</strong> to include everyone in the queue.
              </p>
              <LeadsTable
                leads={filteredLeads}
                emptyLabel={
                  leads.length === 0
                    ? undefined
                    : "No contacts in this tab — try another filter or import a spreadsheet."
                }
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
