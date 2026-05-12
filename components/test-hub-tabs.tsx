"use client";

import { useState } from "react";

import { TestEmailForm } from "@/components/test-email-form";
import { TestPdfForm } from "@/components/test-pdf-form";
import { cn } from "@/lib/utils";

type Tab = "email" | "pdf";

export function TestHubTabs() {
  const [tab, setTab] = useState<Tab>("email");

  return (
    <div className="flex w-full flex-col gap-6">
      <div
        role="tablist"
        aria-label="Test tools"
        className="flex w-full gap-1 rounded-lg border border-border bg-muted/40 p-1 sm:inline-flex sm:w-auto"
      >
        {(
          [
            { id: "email" as const, label: "Test email" },
            { id: "pdf" as const, label: "Test PDF" },
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
        {tab === "email" ? <TestEmailForm /> : <TestPdfForm />}
      </div>
    </div>
  );
}
