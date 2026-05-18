import nodemailer from "nodemailer";

import {
  buildLinkedinLink,
  escapeHtml,
  getEmailTemplates,
  htmlToPlainText,
  interpolateTemplate,
} from "@/lib/email-templates";
import { getResumeProfile } from "@/lib/resume-profile";
import type { Lead } from "@/lib/types";

export async function renderLeadEmail(lead: Lead): Promise<{
  subject: string;
  html: string;
  text: string;
}> {
  const templates = await getEmailTemplates();
  const t = templates[lead.category];
  const profile = await getResumeProfile();

  const first =
    lead.author.trim().split(/\s+/).find(Boolean) || "there";
  const linkedinLink = buildLinkedinLink(profile.linkedinUrl);
  const raw: Record<string, string> = { linkedinLink };

  const vars: Record<string, string> = {
    name: escapeHtml(first),
    fullName: escapeHtml(
      profile.fullName.trim() || lead.author.trim() || "Candidate",
    ),
    phone: escapeHtml(profile.phone.trim()),
    email: escapeHtml(profile.email.trim()),
  };

  const subjectRaw = interpolateTemplate(t.subject, vars, raw);
  const subject = subjectRaw.replace(/<[^>]*>/g, "").trim();

  const html = interpolateTemplate(t.bodyHtml, vars, raw);
  const text = htmlToPlainText(html);

  return { subject, html, text };
}

export function isSmtpConfigured(): boolean {
  if (process.env.SMTP_DRY_RUN === "true") return true;
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.EMAIL_FROM,
  );
}

function createTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error(
      "Outgoing email is not set up. Add SMTP_HOST, SMTP_USER, SMTP_PASS, and EMAIL_FROM to your .env file (or SMTP_DRY_RUN=true for practice).",
    );
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export type SendLeadAttachment = {
  /** Absolute path to a temp file; removed by caller after send. */
  path: string;
  /** Filename shown to recipient (e.g. Anurag_resume.pdf). */
  filename: string;
};

export async function sendLeadEmail(
  lead: Lead,
  attachment?: SendLeadAttachment,
) {
  const { subject, html, text } = await renderLeadEmail(lead);
  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error("EMAIL_FROM is required");
  }

  const attachments =
    attachment &&
    attachment.path &&
    attachment.filename
      ? [
          {
            filename: attachment.filename,
            path: attachment.path,
            contentType: "application/pdf",
          },
        ]
      : undefined;

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
    text,
    html,
    attachments,
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
