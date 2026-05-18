import { FileText, User } from "lucide-react";
import Link from "next/link";

import { AdminEmailTemplates } from "@/components/admin-email-templates";
import { AdminResumeUpload } from "@/components/admin-resume-upload";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Settings | Job outreach",
  description: "Your email identity, message templates, and resume file.",
};

export const dynamic = "force-dynamic";

export default function AdminPage() {
  const displayName =
    process.env.EMAIL_SIGNATURE_NAME?.trim() ||
    process.env.EMAIL_FROM_NAME?.trim() ||
    "";
  const fromEmail = process.env.EMAIL_FROM?.trim() || "";
  const smtpUser = process.env.SMTP_USER?.trim() || "";
  const dryRun = process.env.SMTP_DRY_RUN === "true";

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Settings
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Your profile &amp; messages
        </h1>
        <p className="text-sm text-muted-foreground">
          The summary below comes from your local settings file (the same
          values the app uses when it sends mail). Open the{" "}
          <strong>Menu</strong> to go back to Home or Try features.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="size-5 shrink-0" aria-hidden />
            How your emails look
          </CardTitle>
          <CardDescription>
            These fields are set in your <code className="text-xs">.env</code>{" "}
            file: the name that appears on messages, the <em>from</em> address,
            and your mail-server login (often labeled SMTP in hosting docs).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <dl className="grid gap-3 sm:grid-cols-[8rem_1fr] sm:gap-x-4">
            <dt className="text-muted-foreground">Name on emails</dt>
            <dd className="font-medium text-foreground">
              {displayName || "— not set —"}
            </dd>
            <dt className="text-muted-foreground">Send-from address</dt>
            <dd className="break-all font-medium">
              {fromEmail || "— not set —"}
            </dd>
            <dt className="text-muted-foreground">Mail-server username</dt>
            <dd className="break-all">{smtpUser || "— not set —"}</dd>
            <dt className="text-muted-foreground">Practice mode</dt>
            <dd>
              {dryRun
                ? "On — nothing is delivered for real"
                : "Off — real sends allowed"}
            </dd>
          </dl>
        </CardContent>
      </Card>

      <AdminEmailTemplates />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="size-5 shrink-0" aria-hidden />
            Master resume
          </CardTitle>
          <CardDescription>
            Upload the resume you trust as your source of truth. The app reads
            the text once and reuses it whenever it adapts your CV to a job
            posting (including through the AI on the Try features page).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminResumeUpload />
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/" className="text-primary underline-offset-4 hover:underline">
          ← Home
        </Link>
      </p>
    </div>
  );
}
