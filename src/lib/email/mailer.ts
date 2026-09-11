import 'server-only';
import nodemailer from 'nodemailer';

/**
 * Shared SMTP transport, used by every outbound email in the app (receipt
 * emails, and as of migration 0018, the forgot-password link). Any SMTP
 * account works - a Gmail/Workspace App Password or a free-tier transactional
 * provider - configured entirely via env vars, never hard-coded, per the
 * project's "free tier wherever practical, no silent paid services" policy.
 * Gracefully absent: every caller checks `isEmailConfigured()` first and
 * degrades to a clear, actionable message rather than a raw failure when
 * SMTP hasn't been set up yet (spec #42, Error Handling).
 */
export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export async function sendMail(opts: { to: string; subject: string; text: string; attachments?: MailAttachment[] }) {
  if (!isEmailConfigured()) {
    throw new Error('EMAIL_NOT_CONFIGURED');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    attachments: opts.attachments
  });
}
