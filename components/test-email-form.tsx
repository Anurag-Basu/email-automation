"use client";

import { Loader2, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const inputClass =
  "flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function TestEmailForm() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("Lead automation — SMTP test");
  const [body, setBody] = useState(
    "This is a test message from the lead email automation app.\n\nIf you received this, SMTP is configured correctly."
  );
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [lastWasDryRun, setLastWasDryRun] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dryRunMode, setDryRunMode] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/test-email", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { dryRunMode?: boolean };
        if (!cancelled) setDryRunMode(Boolean(data.dryRunMode));
      } catch {
        if (!cancelled) setDryRunMode(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setLastResult(null);
    setLastWasDryRun(false);
    try {
      const res = await fetch("/api/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim() || undefined,
          body: body.trim(),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        messageId?: string;
        dryRun?: boolean;
      };
      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }
      const msg = data.dryRun
        ? `Dry run (no SMTP): fake id ${data.messageId ?? "n/a"} — no email was sent.`
        : `Sent. Message-ID: ${data.messageId ?? "n/a"}`;
      setLastResult(msg);
      setLastWasDryRun(Boolean(data.dryRun));
      toast.success(data.dryRun ? "Dry run only — turn off SMTP_DRY_RUN to send" : "Test email sent");
    } catch (err) {
      const m = err instanceof Error ? err.message : "Send failed";
      setError(m);
      toast.error(m);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send test</CardTitle>
        <CardDescription>
          Uses <code className="text-xs">EMAIL_FROM</code> as the sender. With{" "}
          <code className="text-xs">SMTP_DRY_RUN=true</code>, nothing is delivered
          over the network.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {dryRunMode === true ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>SMTP dry run is on</AlertTitle>
            <AlertDescription className="space-y-2 text-sm">
              <p>
                In your <code className="rounded bg-muted px-1">.env</code>,{" "}
                <code className="rounded bg-muted px-1">SMTP_DRY_RUN=true</code>{" "}
                tells the app to <strong>never</strong> connect to Gmail — you only
                get a fake message id.
              </p>
              <p>
                To send real mail: set{" "}
                <code className="rounded bg-muted px-1">SMTP_DRY_RUN=false</code>{" "}
                (or delete that line), keep valid{" "}
                <code className="rounded bg-muted px-1">SMTP_*</code> and{" "}
                <code className="rounded bg-muted px-1">EMAIL_FROM</code>, then{" "}
                <strong>restart</strong> the dev server or Docker container so env
                reloads.
              </p>
            </AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="space-y-2">
            <label htmlFor="test-to" className="text-sm font-medium">
              Recipient
            </label>
            <input
              id="test-to"
              type="email"
              required
              autoComplete="email"
              className={inputClass}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="test-subject" className="text-sm font-medium">
              Subject <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id="test-subject"
              type="text"
              className={inputClass}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Lead automation — SMTP test"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="test-body" className="text-sm font-medium">
              Body (plain text)
            </label>
            <textarea
              id="test-body"
              required
              rows={8}
              className={`${inputClass} min-h-[140px] resize-y`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Could not send</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {lastResult ? (
            <Alert variant={lastWasDryRun ? "destructive" : "default"}>
              <AlertTitle>{lastWasDryRun ? "Dry run result" : "Result"}</AlertTitle>
              <AlertDescription className="space-y-2">
                <p className="font-mono text-xs">{lastResult}</p>
                {lastWasDryRun ? (
                  <p className="text-sm">
                    Nothing is missing from the code — disable dry run in{" "}
                    <code className="rounded bg-muted px-1">.env</code> and restart.
                  </p>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" disabled={sending}>
            {sending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Send aria-hidden />
            )}
            Send test email
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
