import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';
import { getReceiptDetail } from '@/lib/receipts/getReceiptDetail';
import { generateReceiptPdf } from '@/lib/pdf/receipt';
import { isEmailConfigured, sendReceiptEmail } from '@/lib/email/sendReceiptEmail';
import { formatCurrency } from '@/lib/utils/format';

export const runtime = 'nodejs';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('receipts.read');

    if (!isEmailConfigured()) {
      return NextResponse.json(
        {
          error: 'EMAIL_NOT_CONFIGURED',
          message: 'Email sending has not been set up yet. Ask a Super Admin to configure SMTP settings, or use Download PDF / Print instead.'
        },
        { status: 501 }
      );
    }

    const supabase = createClient();
    const detail = await getReceiptDetail(supabase, session.orgId, params.id);
    const { data: org } = await supabase.from('organizations').select('*').eq('id', session.orgId).single();

    const recipient = detail.student.parent_email || detail.student.student_email;
    if (!recipient) {
      return NextResponse.json(
        { error: 'NO_EMAIL_ON_FILE', message: 'This student has no email address on file.' },
        { status: 422 }
      );
    }

    const bytes = await generateReceiptPdf({
      orgName: org?.name ?? 'COMETE LEARNING',
      orgAddress: org?.address ?? null,
      orgPhone: org?.phone ?? null,
      orgEmail: org?.email ?? null,
      receiptNumber: detail.receipt.receipt_number,
      issuedAt: detail.receipt.issued_at,
      status: detail.receipt.status,
      studentName: detail.student.name,
      studentCode: detail.student.student_code,
      guardianName: detail.student.guardian_name,
      courseName: detail.student.courses?.name ?? null,
      batchName: detail.student.batches?.name ?? null,
      academicYearName: (detail.receipt as any).academic_years?.name ?? null, // eslint-disable-line @typescript-eslint/no-explicit-any
      installmentLabel: detail.installmentLabel,
      previousOutstanding: detail.previousOutstanding,
      amountReceived: detail.payment.amount,
      paymentMode: detail.payment.payment_mode,
      referenceNumber: detail.payment.reference_number,
      currentOutstanding: detail.currentOutstanding,
      authorizedBy: detail.authorizedBy
    });

    await sendReceiptEmail({
      to: recipient,
      studentName: detail.student.name,
      receiptNumber: detail.receipt.receipt_number,
      amount: formatCurrency(detail.payment.amount),
      pdfBytes: bytes
    });

    return NextResponse.json({ data: { sent: true, to: recipient } });
  } catch (error) {
    return apiError(error);
  }
}
