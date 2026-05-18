"use client";

import { useEffect, useState } from "react";

import { TestEmailForm } from "@/components/test-email-form";
import { TestPdfForm } from "@/components/test-pdf-form";
import { TestVertexForm } from "@/components/test-vertex-form";
import { cn } from "@/lib/utils";

type Tab = "email" | "pdf" | "vertex";

function parseTabParam(raw: string | undefined): Tab | undefined {
  if (raw === "email" || raw === "pdf" || raw === "vertex") return raw;
  return undefined;
}

export function TestHubTabs({ initialTab }: { initialTab?: string }) {
  const fromServer = parseTabParam(initialTab);
  const [tab, setTab] = useState<Tab>(fromServer ?? "email");

  useEffect(() => {
    const next = parseTabParam(initialTab);
    if (next) setTab(next);
  }, [initialTab]);

  return (
    <div className="flex w-full flex-col gap-6">
      <div
        role="tablist"
        aria-label="Feature checks"
        className="flex w-full gap-1 rounded-lg border border-border bg-muted/40 p-1 sm:inline-flex sm:w-auto"
      >
        {(
          [
            { id: "email" as const, label: "Outgoing email" },
            { id: "pdf" as const, label: "Text → PDF" },
            { id: "vertex" as const, label: "AI & resume" },
          ] satisfies { id: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            {...(tab === t.id ? { "aria-selected": true as const } : { "aria-selected": false as const })}
            className={cn(
              "min-h-10 flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors sm:flex-none",
              tab === t.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="min-w-0">
        {tab === "email" ? (
          <TestEmailForm />
        ) : tab === "pdf" ? (
          <TestPdfForm />
        ) : (
          <TestVertexForm />
        )}
      </div>
    </div>
  );
}
