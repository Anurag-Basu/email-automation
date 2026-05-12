import Link from "next/link";

import { TestHubTabs } from "@/components/test-hub-tabs";

export const metadata = {
  title: "Test tools | Lead automation",
  description: "Test SMTP email and plain-text to PDF generation.",
};

export default function TestToolsPage() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Local tools
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Test tools</h1>
        <p className="text-sm text-muted-foreground">
          Use the tabs to verify SMTP or to generate a PDF from pasted plain text (no
          Gemini yet).
        </p>
      </div>

      <TestHubTabs />

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/" className="text-primary underline-offset-4 hover:underline">
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}
