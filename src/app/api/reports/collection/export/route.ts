import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';
import { buildCollectionQuery } from '@/lib/reports/collectionQuery';
import { toCsv, toXlsx, type ExportColumn } from '@/lib/export/tabular';
import { generateTablePdf, type TableColumn } from '@/lib/pdf/table';
import { formatCurrency, formatDate } from '@/lib/utils/format';

export const runtime = 'nodejs';
const EXPORT_LIMIT = 5000;

export async function GET(request: Request) {
  try {
    const session = await requirePermission('exports.run');
    await requirePermission('reports.view');
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') ?? 'csv') as 'csv' | 'xlsx' | 'pdf';

    const query = buildCollectionQuery(supabase, {
      orgId: session.orgId,
      from: searchParams.get('from'),
      to: searchParams.get('to'),
      courseId: searchParams.get('course_id'),
      batchId: searchParams.get('batch_id'),
      paymentMode: searchParams.get('payment_mode'),
      createdBy: searchParams.get('created_by')
    });

    const { data, error } = await query.order('payment_date', { ascending: false }).limit(EXPORT_LIMIT);
    if (error) throw error;

    const rows = (data ?? []).map((p: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
      date: p.payment_date,
      receipt_number: p.receipts?.[0]?.receipt_number ?? p.receipts?.receipt_number ?? '',
      student: p.students?.name,
      student_code: p.students?.student_code,
      course: p.students?.courses?.name ?? '',
      batch: p.students?.batches?.name ?? '',
      amount: Number(p.amount).toFixed(2),
      mode: p.payment_mode,
      reference: p.reference_number ?? '',
      collected_by: p.profiles?.full_name ?? ''
    }));

    const filenameBase = `collection-report-${new Date().toISOString().slice(0, 10)}`;

    if (format === 'xlsx') {
      const columns: ExportColumn[] = [
        { key: 'date', label: 'Date', width: 12 },
        { key: 'receipt_number', label: 'Receipt No.', width: 16 },
        { key: 'student', label: 'Student', width: 22 },
        { key: 'student_code', label: 'Student ID', width: 16 },
        { key: 'course', label: 'Course', width: 16 },
        { key: 'batch', label: 'Batch', width: 14 },
        { key: 'amount', label: 'Amount', width: 12 },
        { key: 'mode', label: 'Mode', width: 12 },
        { key: 'reference', label: 'Reference', width: 16 },
        { key: 'collected_by', label: 'Collected By', width: 16 }
      ];
      const buffer = await toXlsx('Collection Report', columns, rows);
      return new Response(Buffer.from(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filenameBase}.xlsx"`
        }
      });
    }

    if (format === 'pdf') {
      const columns: TableColumn[] = [
        { key: 'date', label: 'Date', width: 60 },
        { key: 'receipt_number', label: 'Receipt No.', width: 90 },
        { key: 'student', label: 'Student', width: 130 },
        { key: 'course', label: 'Course', width: 100 },
        { key: 'amount', label: 'Amount', width: 70, align: 'right' },
        { key: 'mode', label: 'Mode', width: 80 },
        { key: 'collected_by', label: 'Collected By', width: 100 }
      ];
      const bytes = await generateTablePdf(
        'COMETE LEARNING - Collection Report',
        `Generated ${formatDate(new Date())} - ${rows.length} transaction(s)`,
        columns,
        rows.map((r) => ({ ...r, date: formatDate(r.date), amount: formatCurrency(Number(r.amount)) }))
      );
      return new Response(Buffer.from(bytes), {
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filenameBase}.pdf"` }
      });
    }

    const columns: ExportColumn[] = [
      { key: 'date', label: 'Date' },
      { key: 'receipt_number', label: 'Receipt No.' },
      { key: 'student', label: 'Student' },
      { key: 'student_code', label: 'Student ID' },
      { key: 'course', label: 'Course' },
      { key: 'batch', label: 'Batch' },
      { key: 'amount', label: 'Amount' },
      { key: 'mode', label: 'Mode' },
      { key: 'reference', label: 'Reference' },
      { key: 'collected_by', label: 'Collected By' }
    ];
    const csv = toCsv(columns, rows);
    return new Response(csv, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filenameBase}.csv"` }
    });
  } catch (error) {
    return apiError(error);
  }
}
