import nodemailer from "nodemailer";

import type { Lead } from "@/lib/types";

function interpolate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    return vars[key] ?? "";
  });
}

export function renderTemplates(lead: Lead) {
  const name = lead.author.trim() || "there";
  const role = lead.description.trim() || "open";
  const signature =
    process.env.EMAIL_SIGNATURE_NAME?.trim() || "Your team";

  const vars = { name, role, signature };

  const subject = interpolate(
    process.env.EMAIL_SUBJECT_TEMPLATE?.trim() ||
      "Opportunity for {{role}} role",
    vars
  );

  const body = interpolate(
    process.env.EMAIL_BODY_TEMPLATE?.trim() ||
      [
        "Hi {{name}},",
        "",
        "I came across your profile regarding {{role}} opportunities.",
        "",
        "Please find my resume attached.",
        "",
        "Best regards,",
        "{{signature}}",
      ].join("\n"),
    vars
  );

  return { subject, body };
}

export function isSmtpConfigured(): boolean {
  if (process.env.SMTP_DRY_RUN === "true") return true;
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.EMAIL_FROM
  );
}

function createTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error(
      "SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and EMAIL_FROM (or SMTP_DRY_RUN=true for testing)."
    );
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const secure =
    process.env.SMTP_SECURE === "true" || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendLeadEmail(lead: Lead) {
  const { subject, body } = renderTemplates(lead);
  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error("EMAIL_FROM is required");
  }

  if (process.env.SMTP_DRY_RUN === "true") {
    return { messageId: `dry-run-${lead.id}` as string };
  }

  const transport = createTransport();
  const info = await transport.sendMail({
    from: process.env.EMAIL_FROM_NAME
      ? `"${process.env.EMAIL_FROM_NAME}" <${from}>`
      : from,
    to: lead.email,
    subject,
    text: body,
  });

  if (!info.messageId) {
    throw new Error("SMTP accepted the message but returned no message id");
  }
  return info;
}

export type TestEmailPayload = {
  to: string;
  subject: string;
  text: string;
};

/** Send a one-off message (e.g. /test page). Respects SMTP_DRY_RUN. */
export async function sendTestEmail({ to, subject, text }: TestEmailPayload) {
  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error("EMAIL_FROM is required");
  }

  if (process.env.SMTP_DRY_RUN === "true") {
    return { messageId: `dry-run-test-${Date.now()}` as string, dryRun: true };
  }

  const transport = createTransport();
  const info = await transport.sendMail({
    from: process.env.EMAIL_FROM_NAME
      ? `"${process.env.EMAIL_FROM_NAME}" <${from}>`
      : from,
    to,
    subject,
    text,
  });

  if (!info.messageId) {
    throw new Error("SMTP accepted the message but returned no message id");
  }
  return { ...info, dryRun: false };
}
