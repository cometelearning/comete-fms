import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';
import { getReceiptDetail } from '@/lib/receipts/getReceiptDetail';
import { generateReceiptPdf } from '@/lib/pdf/receipt';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('receipts.read');
    const supabase = createClient();
    const { receipt, payment, student, installmentLabel, previousOutstanding, currentOutstanding, authorizedBy } = await getReceiptDetail(
      supabase,
      session.orgId,
      params.id
    );

    const { data: org } = await supabase.from('organizations').select('*').eq('id', session.orgId).single();

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
      academicYearName: (receipt as any).academic_years?.name ?? null, // eslint-disable-line @typescript-eslint/no-explicit-any
      installmentLabel,
      previousOutstanding,
      amountReceived: payment.amount,
      paymentMode: payment.payment_mode,
      referenceNumber: payment.reference_number,
      currentOutstanding,
      authorizedBy
    });

    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${receipt.receipt_number}.pdf"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    return apiError(error);
  }
}
