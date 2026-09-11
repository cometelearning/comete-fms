import 'server-only';
import { isEmailConfigured, sendMail } from '@/lib/email/mailer';

export { isEmailConfigured };

export async function sendReceiptEmail(opts: { to: string; studentName: string; receiptNumber: string; amount: string; pdfBytes: Uint8Array }) {
  await sendMail({
    to: opts.to,
    subject: `Fee Receipt ${opts.receiptNumber} - COMETE LEARNING`,
    text: `Dear ${opts.studentName},\n\nThank you for your payment of ${opts.amount}. Please find your receipt ${opts.receiptNumber} attached.\n\nCOMETE LEARNING`,
    attachments: [{ filename: `${opts.receiptNumber}.pdf`, content: Buffer.from(opts.pdfBytes), contentType: 'application/pdf' }]
  });
}
