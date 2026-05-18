"use client";

import { Loader2, Mail } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LeadCategory } from "@/lib/types";

type CategoryTemplate = { subject: string; bodyHtml: string };

type TemplatesState = Record<LeadCategory, CategoryTemplate>;

const TABS: { id: LeadCategory; label: string }[] = [
  { id: "frontend", label: "Frontend" },
  { id: "fullstack", label: "Full-stack" },
  { id: "other", label: "Other" },
];

const fieldClass =
  "flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50";

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text.slice(0, 200) || "Unexpected response");
  }
}

export function AdminEmailTemplates() {
  const [tab, setTab] = useState<LeadCategory>("frontend");
  const [templates, setTemplates] = useState<TemplatesState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/email-templates", { cache: "no-store" });
      const data = await readJson<{
        templates?: TemplatesState;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Failed to load");
      if (!data.templates) throw new Error("Invalid response");
      setTemplates(data.templates);
    } catch {
      setTemplates(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateTabField = (
    field: keyof CategoryTemplate,
    value: string,
  ) => {
    setTemplates((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [tab]: { ...prev[tab], [field]: value },
      };
    });
  };

  const onSave = async () => {
    if (!templates) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templates),
      });
      const data = await readJson<{ ok?: boolean; error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success("Email templates saved");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="size-5 shrink-0" aria-hidden />
          Outbound email templates
        </CardTitle>
        <CardDescription>
          Subject line and message for each category. The actual job-post text is
          not pasted here — it&apos;s used earlier to shape the attached PDF. You
          can use simple HTML for bold, links, etc. Fill-ins:{" "}
          <code className="text-xs">
            {"{{fullName}}, {{phone}}, {{email}}, {{name}}, {{linkedinLink}}"}
          </code>
          . If you saved a LinkedIn link in Settings,{" "}
          <code className="text-xs">{"{{linkedinLink}}"}</code> becomes a
          clickable link for the reader.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading templates…
          </p>
        ) : templates ? (
          <>
            <div
              role="tablist"
              aria-label="Template category"
              className="flex flex-wrap gap-1 rounded-md border border-border bg-muted/20 p-1"
            >
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  {...(tab === t.id
                    ? { "aria-selected": true as const }
                    : { "aria-selected": false as const })}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    tab === t.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Subject</span>
              <input
                className={fieldClass}
                value={templates[tab].subject}
                onChange={(e) => updateTabField("subject", e.target.value)}
                spellCheck
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Message (HTML OK)</span>
              <textarea
                className={`${fieldClass} min-h-[240px] resize-y font-mono text-xs`}
                value={templates[tab].bodyHtml}
                onChange={(e) => updateTabField("bodyHtml", e.target.value)}
                spellCheck
              />
            </label>

            <Button
              type="button"
              disabled={saving}
              onClick={() => void onSave()}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Save templates
            </Button>
          </>
        ) : (
          <p className="text-sm text-destructive">Could not load templates.</p>
        )}
      </CardContent>
    </Card>
  );
}
