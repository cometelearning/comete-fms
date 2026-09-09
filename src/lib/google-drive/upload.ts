import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateReceiptPdf } from '@/lib/pdf/receipt';
import { uploadReceiptPdf } from './client';

/**
 * Best-effort attempt to store a receipt PDF in Google Drive. This NEVER
 * throws - a Drive failure (not connected, network error, revoked access,
 * quota) only ever changes receipts.pdf_status to PENDING/FAILED. The
 * payment and receipt themselves are already committed in Postgres before
 * this function is ever called, so a Drive outage can never lose or corrupt
 * a financial transaction (spec #23).
 */
export async function attemptReceiptDriveUpload(orgId: string, receiptId: string): Promise<void> {
  const admin = createAdminClient();

  try {
    const { data: receipt } = await admin.from('receipts').select('*, academic_years(name)').eq('id', receiptId).eq('org_id', orgId).single();
    if (!receipt) return;
    if (receipt.pdf_status === 'STORED') return;

    const { data: payment } = await admin.from('payments').select('*').eq('id', receipt.payment_id).single();
    const { data: student } = await admin.from('students').select('*, courses(name), batches(name)').eq('id', payment.student_id).single();
    const { data: org } = await admin.from('organizations').select('*').eq('id', orgId).single();
    const { data: allocations } = await admin.from('payment_allocations').select('amount, installments(label)').eq('payment_id', payment.id);
    const { data: creator } = await admin.from('profiles').select('full_name').eq('id', receipt.created_by).single();
    const { data: summary } = await admin
      .from('student_fee_summary')
      .select('outstanding_total')
      .eq('student_fee_account_id', payment.student_fee_account_id)
      .single();

    const currentOutstanding = summary?.outstanding_total ?? 0;
    const previousOutstanding = Number(currentOutstanding) + Number(payment.amount);
    const installmentLabel = (allocations ?? [])
      .map((a: any) => a.installments?.label) // eslint-disable-line @typescript-eslint/no-explicit-any
      .filter(Boolean)
      .join(', ');

    const bytes = await generateReceiptPdf({
      orgName: org?.name ?? 'COMETE LEARNING',
      orgAddress: org?.address ?? null,
      orgPhone: org?.phone ?? null,
      orgEmail: org?.email ?? null,
      receiptNumber: receipt.receipt_number,
      issuedAt: receipt.issued_at,
      status: receipt.status,
      studentName: student.name,
      studentCode: student.student_code,
      guardianName: student.guardian_name,
      courseName: student.courses?.name ?? null,
      batchName: student.batches?.name ?? null,
      academicYearName: receipt.academic_years?.name ?? null,
      installmentLabel: installmentLabel || null,
      previousOutstanding,
      amountReceived: payment.amount,
      paymentMode: payment.payment_mode,
      referenceNumber: payment.reference_number,
      currentOutstanding,
      authorizedBy: creator?.full_name ?? 'System'
    });

    const issuedDate = new Date(receipt.issued_at);
    const monthLabel = issuedDate.toLocaleString('en-US', { month: 'long' });
    const yearLabel = receipt.academic_years?.name ?? String(issuedDate.getFullYear());
    const fileName = `${receipt.receipt_number}.pdf`;

    const { fileId } = await uploadReceiptPdf(orgId, yearLabel, monthLabel, fileName, bytes);

    await admin.from('receipts').update({ pdf_status: 'STORED', drive_file_id: fileId, pdf_last_error: null }).eq('id', receiptId);
    await admin.from('google_drive_files').insert({
      org_id: orgId,
      file_type: 'RECEIPT',
      related_receipt_id: receiptId,
      file_name: fileName,
      drive_path: `COMETE LEARNING - FEE MANAGEMENT/Receipts/${yearLabel}/${monthLabel}/${fileName}`,
      drive_file_id: fileId,
      status: 'STORED',
      attempts: (receipt.pdf_storage_attempts ?? 0) + 1
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const notConnected = message.includes('DRIVE_NOT_CONNECTED');
    try {
      const { data: receipt } = await admin.from('receipts').select('pdf_storage_attempts').eq('id', receiptId).single();
      await admin
        .from('receipts')
        .update({
          pdf_status: notConnected ? 'PENDING' : 'FAILED',
          pdf_last_error: notConnected ? null : message,
          pdf_storage_attempts: (receipt?.pdf_storage_attempts ?? 0) + 1
        })
        .eq('id', receiptId);
    } catch {
      // Swallow - never let a logging failure surface to the caller.
    }
  }
}
