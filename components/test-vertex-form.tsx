"use client";

import Link from "next/link";
import { Download, Loader2, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

const defaultPrompt =
  "Reply in one short sentence confirming the AI connection is working.";

type VertexStatus = {
  vertexEnvConfigured: boolean;
  hasApplicationCredentials: boolean;
  model: string;
  hasResume?: boolean;
  resumeTextChars?: number | null;
  profileReadyForTailor?: boolean;
  pdfDownloadBaseName?: string | null;
};

type AtsKeywordHint = {
  coveragePercent: number;
  jdDistinctTermCount: number;
  matchedTerms: string[];
  missingTerms: string[];
};

export function TestVertexForm() {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [reply, setReply] = useState("");
  const [rawLoading, setRawLoading] = useState(false);
  const [rawError, setRawError] = useState<string | null>(null);

  const [jobDescription, setJobDescription] = useState("");
  const [tailoredText, setTailoredText] = useState("");
  const [atsHint, setAtsHint] = useState<AtsKeywordHint | null>(null);
  const [tailorTruncated, setTailorTruncated] = useState(false);
  const [tailorLoading, setTailorLoading] = useState(false);
  const [tailorError, setTailorError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [tailorPdfBaseName, setTailorPdfBaseName] = useState<string | null>(null);

  const [status, setStatus] = useState<VertexStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/test-vertex");
        if (!res.ok) return;
        const j = (await res.json()) as VertexStatus;
        if (!cancelled) setStatus(j);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runRaw = async () => {
    setRawLoading(true);
    setRawError(null);
    setReply("");
    try {
      const res = await fetch("/api/test-vertex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        text?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      if (typeof data.text !== "string") {
        throw new Error("Invalid response");
      }
      setReply(data.text);
      toast.success("AI replied");
    } catch (e) {
      const m = e instanceof Error ? e.message : "AI request failed";
      setRawError(m);
      toast.error(m);
    } finally {
      setRawLoading(false);
    }
  };

  const runTailor = async () => {
    setTailorLoading(true);
    setTailorError(null);
    setTailoredText("");
    setAtsHint(null);
    setTailorTruncated(false);
    setTailorPdfBaseName(null);
    try {
      const res = await fetch("/api/test-vertex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "tailor",
          jobDescription: jobDescription.trim(),
        }),
      });
      const raw = await res.text();
      let data: {
        error?: string;
        text?: string;
        atsHint?: AtsKeywordHint | null;
        mode?: string;
        truncated?: boolean;
        pdfDownloadBaseName?: string;
      } = {};
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        data = {};
      }
      if (!res.ok) {
        throw new Error(
          (typeof data.error === "string" && data.error) ||
            raw.trim().slice(0, 280) ||
            `Request failed (${res.status})`,
        );
      }
      if (typeof data.text !== "string") {
        throw new Error("Invalid response");
      }
      setTailoredText(data.text);
      setTailorTruncated(Boolean(data.truncated));
      setAtsHint(
        data.atsHint === null || data.atsHint === undefined
          ? null
          : data.atsHint,
      );
      if (typeof data.pdfDownloadBaseName === "string" && data.pdfDownloadBaseName.trim()) {
        setTailorPdfBaseName(data.pdfDownloadBaseName.trim());
      }
      toast.success("Resume draft ready");
    } catch (e) {
      const m = e instanceof Error ? e.message : "Tailor request failed";
      setTailorError(m);
      toast.error(m);
    } finally {
      setTailorLoading(false);
    }
  };

  const downloadTailoredPdf = async () => {
    if (!tailoredText.trim()) return;
    setPdfLoading(true);
    try {
      const res = await fetch("/api/test-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: tailoredText,
          filename:
            tailorPdfBaseName ??
            status?.pdfDownloadBaseName ??
            "tailored-resume-preview",
        }),
      });
      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errJson.error || `PDF failed (${res.status})`);
      }
      const blob = await res.blob();
      if (blob.type !== "application/pdf") {
        throw new Error("Server did not return a PDF");
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const base =
        tailorPdfBaseName ??
        (typeof status?.pdfDownloadBaseName === "string"
          ? status.pdfDownloadBaseName
          : null) ??
        "tailored-resume-preview";
      a.download = base.toLowerCase().endsWith(".pdf")
        ? base
        : `${base}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch (e) {
      const m = e instanceof Error ? e.message : "PDF download failed";
      toast.error(m);
    } finally {
      setPdfLoading(false);
    }
  };

  const envLine = status && (
    <p className="text-xs text-muted-foreground">
      Setup: cloud project {status.vertexEnvConfigured ? "ok" : "missing"} ·
      service account / key file{" "}
      {status.hasApplicationCredentials ? "found" : "not set (advanced login only)"}{" "}
      · model <code className="text-[11px]">{status.model}</code>
      {typeof status.hasResume === "boolean" ? (
        <>
          {" "}
          · saved resume{" "}
          {status.hasResume ? (
            <>
              <span className="text-foreground">yes</span>
              {typeof status.resumeTextChars === "number" ? (
                <span className="text-muted-foreground">
                  {" "}
                  (~{status.resumeTextChars.toLocaleString()} characters)
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-destructive">no — upload under Settings</span>
          )}
        </>
      ) : null}
      {typeof status.profileReadyForTailor === "boolean" ? (
        <>
          {" "}
          · your name saved{" "}
          {status.profileReadyForTailor ? (
            <span className="text-foreground">yes</span>
          ) : (
            <span className="text-destructive">incomplete — add names in Settings</span>
          )}
        </>
      ) : null}
    </p>
  );

  return (
    <div className="flex flex-col gap-6">
      {envLine}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 shrink-0" aria-hidden />
            Quick AI check
          </CardTitle>
          <CardDescription>
            Sends a simple question to Google&apos;s AI on your cloud project
            (same service the app uses for sorting posts and rewriting resumes).
            Your IT setup should include a project, region, and credentials
            file path — see the project README if this fails.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {rawError && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{rawError}</AlertDescription>
            </Alert>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Prompt</span>
            <textarea
              className={`${inputClass} min-h-[120px] resize-y font-mono text-xs`}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={rawLoading}
              spellCheck={false}
            />
          </label>

          <Button
            type="button"
            onClick={() => void runRaw()}
            disabled={rawLoading}
          >
            {rawLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Calling AI…
              </>
            ) : (
              "Run quick check"
            )}
          </Button>

          {reply ? (
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                AI reply
              </p>
              <pre className="mt-1 whitespace-pre-wrap wrap-break-word text-sm">
                {reply}
              </pre>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="size-5 shrink-0" aria-hidden />
            Match resume to a job posting
          </CardTitle>
          <CardDescription>
            Uses the resume you uploaded under{" "}
            <Link
              href="/admin"
              className="text-primary underline-offset-4 hover:underline"
            >
              Settings → Master resume
            </Link>{" "}
            and the AI to draft a version that speaks to the role. You get a
            readable preview and can download a PDF. Always proof-read facts
            before you apply.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {status?.hasResume === false ? (
            <Alert>
              <AlertTitle>No resume uploaded</AlertTitle>
              <AlertDescription>
                Upload your PDF or text resume on the{" "}
                <Link
                  href="/admin"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Settings
                </Link>{" "}
                page first, then return here.
              </AlertDescription>
            </Alert>
          ) : null}

          {status?.hasResume !== false && status?.profileReadyForTailor === false ? (
            <Alert>
              <AlertTitle>Add your name in Settings</AlertTitle>
              <AlertDescription>
                Save your <strong>full name</strong> and <strong>first name</strong> under{" "}
                <Link
                  href="/admin"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Settings → Name &amp; contact on PDFs
                </Link>{" "}
                so headers and downloads look right (
                <code className="text-xs">first_name_resume.pdf</code>
                ).
              </AlertDescription>
            </Alert>
          ) : null}

          {tailorError && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{tailorError}</AlertDescription>
            </Alert>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Job description or posting</span>
            <textarea
              className={`${inputClass} min-h-[180px] resize-y`}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              disabled={tailorLoading}
              placeholder="Paste the job description or advert text here…"
              spellCheck
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void runTailor()}
              disabled={
                tailorLoading ||
                !jobDescription.trim() ||
                status?.hasResume === false ||
                status?.profileReadyForTailor === false
              }
            >
              {tailorLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Generating…
                </>
              ) : (
                <>
                  <Wand2 className="size-4 shrink-0" aria-hidden />
                  Generate tailored resume
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void downloadTailoredPdf()}
              disabled={pdfLoading || !tailoredText.trim()}
            >
              {pdfLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Building PDF…
                </>
              ) : (
                <>
                  <Download className="size-4 shrink-0" aria-hidden />
                  Download PDF
                </>
              )}
            </Button>
          </div>

          {atsHint ? (
            <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground">
                Keyword ideas (not a real ATS score)
              </p>
              <p className="mt-1 text-foreground">
                Rough overlap between the posting&apos;s words and your draft:{" "}
                <strong>{atsHint.coveragePercent}%</strong> (
                {atsHint.matchedTerms.length} / {atsHint.jdDistinctTermCount}{" "}
                terms). Employer systems vary — treat this as a guide only.
              </p>
              {atsHint.missingTerms.length > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Sample words from the posting that are still light in the draft:{" "}
                  <span className="wrap-break-word text-foreground">
                    {atsHint.missingTerms.join(", ")}
                  </span>
                </p>
              ) : null}
            </div>
          ) : tailoredText && !tailorLoading ? (
            <p className="text-xs text-muted-foreground">
              Keyword ideas skipped (posting too short to compare meaningfully).
            </p>
          ) : null}

          {tailorTruncated ? (
            <Alert>
              <AlertTitle>Output was trimmed</AlertTitle>
              <AlertDescription>
                The draft was too long to return in one piece, so you&apos;re
                seeing the start only. Try a shorter posting, or shorten your
                saved resume, then run again.
              </AlertDescription>
            </Alert>
          ) : null}

          {tailoredText ? (
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Tailored resume (preview)
              </p>
              <div className="mt-3 max-h-[min(70vh,28rem)] overflow-y-auto rounded-md border border-border bg-background px-4 py-3 text-sm leading-relaxed text-foreground [&_h1+p]:whitespace-pre-wrap [&_h1+p]:text-center">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className="mb-2 text-center text-2xl font-bold tracking-tight">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="mb-2 mt-6 text-lg font-semibold text-foreground first:mt-0">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="mb-1 mt-4 text-base font-semibold">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="mb-2 last:mb-0">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="mb-2 list-disc space-y-1 pl-5">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="mb-2 list-decimal space-y-1 pl-5">{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li className="leading-relaxed">{children}</li>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        className="text-primary underline underline-offset-2 hover:opacity-90"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {children}
                      </a>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-foreground">{children}</strong>
                    ),
                  }}
                >
                  {tailoredText}
                </ReactMarkdown>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
