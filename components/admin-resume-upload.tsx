"use client";

import { FileUp, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type ResumeMeta = {
  mimeType: string;
  originalFilename: string;
  savedAt: string;
  textChars: number;
};

type ResumeProfile = {
  fullName: string;
  firstName: string;
  email: string;
  phone: string;
  githubUrl: string;
  linkedinUrl: string;
  updatedAt: string;
};

const fieldClass =
  "flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text.slice(0, 200) || "Unexpected response");
  }
}

export function AdminResumeUpload() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [meta, setMeta] = useState<ResumeMeta | null>(null);
  const [profileReadyForTailor, setProfileReadyForTailor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/resume", { cache: "no-store" });
      const data = await readJson<{
        meta: ResumeMeta | null;
        profile: ResumeProfile;
        profileReadyForTailor: boolean;
        error?: string;
      }>(res);
      if (!res.ok) {
        throw new Error(data.error || "Failed to load resume status");
      }
      setMeta(data.meta);
      setProfileReadyForTailor(data.profileReadyForTailor);
      const p = data.profile;
      setFullName(p.fullName);
      setFirstName(p.firstName);
      setEmail(p.email);
      setPhone(p.phone);
      setGithubUrl(p.githubUrl);
      setLinkedinUrl(p.linkedinUrl);
    } catch {
      setMeta(null);
      setProfileReadyForTailor(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onSaveProfile = async () => {
    if (!fullName.trim() || !firstName.trim()) {
      toast.message("Please add your full name and first name so we can name files and headers correctly.");
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetch("/api/admin/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          firstName: firstName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          githubUrl: githubUrl.trim(),
          linkedinUrl: linkedinUrl.trim(),
        }),
      });
      const data = await readJson<{ ok?: boolean; profile?: ResumeProfile; error?: string }>(
        res,
      );
      if (!res.ok) {
        throw new Error(data.error || `Save failed (${res.status})`);
      }
      if (data.profile) {
        setFullName(data.profile.fullName);
        setFirstName(data.profile.firstName);
        setEmail(data.profile.email);
        setPhone(data.profile.phone);
        setGithubUrl(data.profile.githubUrl);
        setLinkedinUrl(data.profile.linkedinUrl);
        setProfileReadyForTailor(
          Boolean(data.profile.fullName.trim() && data.profile.firstName.trim()),
        );
      }
      toast.success("Saved — we'll use this for email headers and PDF names");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setProfileSaving(false);
    }
  };

  const onUpload = async () => {
    const f = fileRef.current?.files?.[0];
    if (!f) {
      toast.message("Choose a PDF or .txt file first");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", f);
      const res = await fetch("/api/admin/resume", {
        method: "POST",
        body: form,
      });
      const data = await readJson<{ ok?: boolean; meta?: ResumeMeta; error?: string }>(
        res,
      );
      if (!res.ok) {
        throw new Error(data.error || `Upload failed (${res.status})`);
      }
      if (data.meta) setMeta(data.meta);
      toast.success("Resume saved — text is ready for the AI to work from");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const savedLabel = meta
    ? `${meta.originalFilename} · ${meta.textChars.toLocaleString()} chars extracted · ${new Date(meta.savedAt).toLocaleString()}`
    : null;

  const pdfHint =
    firstName.trim().length > 0
      ? `${firstName.trim().replace(/\s+/g, "_")}_resume.pdf`
      : "first_name_resume.pdf";

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Upload your main resume as a <strong>PDF</strong> or{" "}
        <strong>plain text</strong> file. We store it on this machine and pull
        out the text so the assistant can rewrite it for specific roles. Your{" "}
        <strong>name and contact details</strong> below are added to the top of
        generated PDFs — they are not invented by the AI.
      </p>

      <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
        <h3 className="text-sm font-semibold text-foreground">Name &amp; contact on PDFs</h3>
        <p className="text-xs text-muted-foreground">
          Required: <strong>full name</strong> and <strong>first name</strong>{" "}
          (first name becomes the PDF file name, e.g.{" "}
          <code className="text-[11px]">{pdfHint}</code>). Email, phone, GitHub,
          and LinkedIn show in the header row as links where it makes sense.
        </p>
        {!loading && !profileReadyForTailor ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Add full name and first name, then save, before using Try features → AI &amp; resume.
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Full name
            <input
              className={fieldClass}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Anurag Kumar"
              autoComplete="name"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            First name (for file name)
            <input
              className={fieldClass}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Anurag"
              autoComplete="given-name"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Email
            <input
              className={fieldClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Phone
            <input
              className={fieldClass}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 …"
              autoComplete="tel"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-2">
            GitHub URL
            <input
              className={fieldClass}
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/yourhandle"
              autoComplete="url"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-2">
            LinkedIn profile URL
            <input
              className={fieldClass}
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/…"
              autoComplete="url"
            />
          </label>
        </div>

        <Button
          type="button"
          disabled={profileSaving}
          onClick={() => void onSaveProfile()}
        >
          {profileSaving ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            "Save profile"
          )}
        </Button>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Checking saved resume…
        </p>
      ) : meta ? (
        <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Saved file: </span>
          {savedLabel}
        </p>
      ) : (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          No resume uploaded yet — add one to unlock AI tailoring on Home and in Try features.
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.txt,application/pdf,text/plain"
        className="sr-only"
        aria-label="Choose resume PDF or text file"
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          Choose file
        </Button>
        <Button type="button" disabled={uploading} onClick={() => void onUpload()}>
          {uploading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <FileUp className="size-4" aria-hidden />
          )}
          Upload resume
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Tip: you can also build a one-off PDF from pasted text under{" "}
        <Link
          href="/test?tab=pdf"
          className="text-primary underline-offset-4 hover:underline"
        >
          Try features → Text → PDF
        </Link>{" "}
        (separate from the saved resume above).
      </p>
    </div>
  );
}
