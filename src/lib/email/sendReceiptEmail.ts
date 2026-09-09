import 'server-only';
import nodemailer from 'nodemailer';

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

export async function sendReceiptEmail(opts: { to: string; studentName: string; receiptNumber: string; amount: string; pdfBytes: Uint8Array }) {
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
    subject: `Fee Receipt ${opts.receiptNumber} - COMETE LEARNING`,
    text: `Dear ${opts.studentName},\n\nThank you for your payment of ${opts.amount}. Please find your receipt ${opts.receiptNumber} attached.\n\nCOMETE LEARNING`,
    attachments: [{ filename: `${opts.receiptNumber}.pdf`, content: Buffer.from(opts.pdfBytes), contentType: 'application/pdf' }]
  });
}
