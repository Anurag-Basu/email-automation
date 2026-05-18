"use client";

import { Download, Eye, FileText, Loader2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
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

const defaultBody = `Jane Doe
jane@example.com · +1 555-0100 · github.com/jane · linkedin.com/in/jane

Profile
Full-stack engineer focused on TypeScript, React, and Node.js. 5+ years shipping web products.

Work Experience
Codevyasa — Paytm (SDE-2) (Feb 2025 – Present)
• Led checkout UI refresh; reduced bundle size with code-splitting.
• Built reusable widget library shared across merchant flows.

Dataslush — Full-Stack Developer (Oct 2023 – Oct 2024)
• Shipped dashboards with React, Next.js, and Node on GCP.

Skills
React, Next.js, TypeScript, Node.js, PostgreSQL, Docker, REST APIs

Education
BCA | State University (2018 – 2021)
CGPA: 8.2`;

export function TestPdfForm() {
  const [text, setText] = useState(defaultBody);
  const [filename, setFilename] = useState("resume-preview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastBlobRef = useRef<Blob | null>(null);
  const lastUrlRef = useRef<string | null>(null);

  const revokeLastUrl = useCallback(() => {
    if (lastUrlRef.current) {
      URL.revokeObjectURL(lastUrlRef.current);
      lastUrlRef.current = null;
    }
    lastBlobRef.current = null;
  }, []);

  const generatePdf = async (): Promise<Blob | null> => {
    setLoading(true);
    setError(null);
    revokeLastUrl();
    try {
      const base = filename.trim() || "resume-preview";
      const res = await fetch("/api/test-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, filename: base }),
      });
      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error || `Request failed (${res.status})`);
      }
      const blob = await res.blob();
      if (blob.type !== "application/pdf") {
        throw new Error("Server did not return a PDF");
      }
      lastBlobRef.current = blob;
      const url = URL.createObjectURL(blob);
      lastUrlRef.current = url;
      toast.success("PDF generated");
      return blob;
    } catch (e) {
      const m = e instanceof Error ? e.message : "PDF failed";
      setError(m);
      toast.error(m);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const downloadName = () => {
    const base = filename.trim() || "resume-preview";
    return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
  };

  const onDownload = async () => {
    let blob = lastBlobRef.current;
    if (!blob) {
      blob = await generatePdf();
    }
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadName();
    a.click();
    URL.revokeObjectURL(url);
  };

  const onOpenInNewTab = async () => {
    let url = lastUrlRef.current;
    if (!url) {
      await generatePdf();
      url = lastUrlRef.current;
    }
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-5" aria-hidden />
          Build a PDF from text
        </CardTitle>
        <CardDescription>
          Paste plain text. Lines like <strong>Profile</strong>,{" "}
          <strong>Work experience</strong>, and <strong>Skills</strong> work well
          as section titles. Start bullets with <code className="text-xs">•</code>,{" "}
          <code className="text-xs">-</code>, or <code className="text-xs">1.</code>{" "}
          The first line is treated as your name when it looks like a person&apos;s name.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="space-y-2">
          <label htmlFor="pdf-filename" className="text-sm font-medium">
            File name (without path)
          </label>
          <input
            id="pdf-filename"
            type="text"
            className={inputClass}
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="resume-preview"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            <code className="rounded bg-muted px-1">.pdf</code> is added automatically if
            missing.
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="pdf-body" className="text-sm font-medium">
            Body (plain text)
          </label>
          <textarea
            id="pdf-body"
            required
            rows={14}
            className={`${inputClass} min-h-[200px] resize-y font-mono text-xs sm:text-sm`}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not generate PDF</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => void generatePdf()}
          >
            {loading ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <FileText aria-hidden />
            )}
            Generate PDF
          </Button>
          <Button type="button" disabled={loading} onClick={() => void onDownload()}>
            <Download aria-hidden />
            Download
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => void onOpenInNewTab()}
          >
            <Eye aria-hidden />
            Open in new tab
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
