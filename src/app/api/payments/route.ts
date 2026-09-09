import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';
import { attemptReceiptDriveUpload } from '@/lib/google-drive/upload';

export const runtime = 'nodejs';

const schema = z.object({
  student_fee_account_id: z.string().uuid(),
  installment_id: z.string().uuid().nullable(),
  amount: z.number().positive(),
  payment_mode: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER']),
  payment_date: z.string(),
  reference_number: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  idempotency_key: z.string().uuid()
});

/**
 * Collects a payment. Everything financially sensitive - the payment row,
 * the installment allocation, the atomically-generated receipt number, and
 * the audit log entry - happens inside record_payment() as a single
 * Postgres transaction (see supabase/migrations/0005). The idempotency_key
 * is generated once on the client when the Collect Fee form is opened, so a
 * duplicate click or a network retry replays the SAME payment instead of
 * creating a second one.
 */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('payments.collect');
    const body = schema.parse(await request.json());
    const supabase = createClient();

    const { data, error } = await supabase.rpc('record_payment', {
      p_student_fee_account_id: body.student_fee_account_id,
      p_installment_id: body.installment_id,
      p_amount: body.amount,
      p_payment_mode: body.payment_mode,
      p_payment_date: body.payment_date,
      p_reference_number: body.reference_number || null,
      p_remarks: body.remarks || null,
      p_idempotency_key: body.idempotency_key
    });
    if (error) throw error;

    // The payment + receipt are already committed above. Storing the PDF in
    // Google Drive is best-effort and must never affect the financial
    // transaction (spec #23) - attemptReceiptDriveUpload never throws. We
    // await it here (rather than firing-and-forgetting) because a Vercel
    // serverless function stops executing once the response is sent, so
    // this is the only reliable place to run it without a background queue.
    if (!data.replayed) {
      await attemptReceiptDriveUpload(session.orgId, data.receipt_id);
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
