import Link from "next/link";

import { TestHubTabs } from "@/components/test-hub-tabs";

export const metadata = {
  title: "Try features | Job outreach",
  description:
    "Test outgoing email, turn text into a PDF, and preview how AI adjusts your resume for a job posting.",
};

export default async function TestToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : undefined;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Safe checks before you go live
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Try features</h1>
        <p className="text-sm text-muted-foreground">
          Use the tabs below to send a test message, build a PDF from pasted
          text, or run the AI resume helper (simple ping and “match my resume
          to this job” preview). Open the <strong>Menu</strong> (top right) for
          Home or Settings.
        </p>
      </div>

      <TestHubTabs initialTab={tab} />

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/"
          className="text-primary underline-offset-4 hover:underline"
        >
          ← Home
        </Link>
      </p>
    </div>
  );
}
