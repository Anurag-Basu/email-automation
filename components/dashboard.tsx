"use client";

import {
  Loader2,
  Mail,
  RefreshCw,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
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
import type { Lead } from "@/lib/types";

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text.slice(0, 200) || "Unexpected response from server");
  }
}

export function Dashboard({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<string[]>([]);
  const [importSkipped, setImportSkipped] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const onUpload = async (file: File) => {
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
        skipped?: { line: number; reason: string }[];
        skippedTruncated?: boolean;
      }>(res);

      if (!res.ok) {
        if (data.rowErrors?.length) {
          setRowErrors(data.rowErrors);
        }
        throw new Error(data.error || "Upload failed");
      }

      const skipped = data.skippedCount ?? 0;
      if (skipped > 0 && data.skipped?.length) {
        const lines = data.skipped.map((s) => `Row ${s.line}: ${s.reason}`);
        if (data.skippedTruncated) {
          lines.push(
            `…and more rows were skipped (total skipped: ${skipped}).`
          );
        }
        setImportSkipped(lines);
      }
      toast.success(
        skipped > 0
          ? `Imported ${data.count ?? 0} leads (${skipped} row(s) skipped after cleaning)`
          : `Imported ${data.count ?? 0} leads`
      );
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

  const sendEmails = async () => {
    setSending(true);
    setError(null);
    setRowErrors([]);
    setImportSkipped([]);
    const pending = leads.filter((l) => l.status === "pending").length;
    if (!pending) {
      toast.message("No pending leads to send");
      setSending(false);
      return;
    }
    const toastId = toast.loading(`Sending ${pending} email(s)…`);
    try {
      const res = await fetch("/api/send-emails", { method: "POST" });
      const data = await readJson<{
        ok?: boolean;
        error?: string;
        sent?: number;
        failed?: number;
        processed?: number;
      }>(res);
      if (!res.ok) {
        throw new Error(data.error || "Send failed");
      }
      toast.success(
        `Done: ${data.sent ?? 0} sent, ${data.failed ?? 0} failed`,
        { id: toastId }
      );
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Send failed";
      toast.error(msg, { id: toastId });
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  const pendingCount = leads.filter((l) => l.status === "pending").length;
  const sentCount = leads.filter((l) => l.status === "sent").length;
  const failedCount = leads.filter((l) => l.status === "failed").length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Local automation
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Lead email automation
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Upload a CSV, review classified leads, then send sequential outreach
            with status tracking. Configure SMTP in{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">.env</code>{" "}
            or use{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              SMTP_DRY_RUN=true
            </code>{" "}
            for testing.{" "}
            <Link
              href="/test"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Test SMTP
            </Link>
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label="Upload CSV file with lead columns"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={uploading || sending}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Upload aria-hidden />
            )}
            Upload CSV
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={sending || uploading || pendingCount === 0}
            onClick={() => void sendEmails()}
          >
            {sending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Mail aria-hidden />
            )}
            Send emails
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
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {rowErrors.length ? (
        <Alert variant="destructive">
          <AlertTitle>CSV validation</AlertTitle>
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
          <AlertTitle>Skipped rows (no usable email after cleaning)</AlertTitle>
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
              <span>Total leads</span>
            </div>
            <CardTitle className="text-2xl tabular-nums">
              {loading ? "—" : leads.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending send</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-amber-700 dark:text-amber-400">
              {loading ? "—" : pendingCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sent / failed</CardDescription>
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
              <CardTitle>Leads</CardTitle>
              <CardDescription>
                Supports standard columns (author, email, description) and
                LinkedIn-style exports (Author, Emails Found, Post Snippet).
                Rows without a valid email after cleaning are skipped.
              </CardDescription>
            </div>
            {!loading && leads.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{pendingCount} pending</Badge>
                <Badge variant="success">{sentCount} sent</Badge>
                {failedCount > 0 ? (
                  <Badge variant="destructive">{failedCount} failed</Badge>
                ) : null}
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          {loading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" aria-hidden />
              Loading…
            </div>
          ) : (
            <div className="p-4 sm:p-6">
              <LeadsTable leads={leads} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
