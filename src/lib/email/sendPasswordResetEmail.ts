import 'server-only';
import { sendMail } from '@/lib/email/mailer';

export async function sendPasswordResetEmail(opts: { to: string; fullName: string; resetUrl: string }) {
  await sendMail({
    to: opts.to,
    subject: 'Reset your COMETE LEARNING password',
    text: `Hi ${opts.fullName},\n\nWe received a request to reset your COMETE LEARNING password. Click the link below to choose a new one - it expires in 30 minutes and can only be used once:\n\n${opts.resetUrl}\n\nIf you didn't request this, you can safely ignore this email; your password will not be changed.\n\nCOMETE LEARNING`
  });
}
