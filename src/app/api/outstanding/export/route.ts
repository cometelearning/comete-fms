import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';
import { buildOutstandingQuery } from '@/lib/reports/outstandingQuery';
import { toCsv, toXlsx, type ExportColumn } from '@/lib/export/tabular';
import { generateTablePdf, type TableColumn } from '@/lib/pdf/table';
import { formatCurrencyForPdf, formatDate } from '@/lib/utils/format';

export const runtime = 'nodejs';

const EXPORT_LIMIT = 5000;

export async function GET(request: Request) {
  try {
    const session = await requirePermission('exports.run');
    await requirePermission('outstanding.view');
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') ?? 'csv') as 'csv' | 'xlsx' | 'pdf';

    const query = buildOutstandingQuery(supabase, {
      orgId: session.orgId,
      academicYearId: searchParams.get('academic_year_id'),
      courseId: searchParams.get('course_id'),
      classId: searchParams.get('class_id'),
      q: searchParams.get('q'),
      overdueOnly: searchParams.get('overdue_only') === 'true',
      minAmount: searchParams.get('min_amount') ? Number(searchParams.get('min_amount')) : null
    });

    const { data, error } = await query.order('outstanding_total', { ascending: false }).limit(EXPORT_LIMIT);
    if (error) throw error;

    const rows = (data ?? []).map((r: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
      student_name: r.students?.name,
      student_code: r.students?.student_code,
      mobile: r.students?.student_mobile ?? r.students?.parent_mobile ?? '',
      course: r.students?.courses?.name ?? '',
      class: r.students?.classes?.name ?? '',
      academic_year: r.academic_years?.name ?? '',
      total_fee: Number(r.total_fee).toFixed(2),
      discount: Number(r.discount_total).toFixed(2),
      paid: Number(r.paid_total).toFixed(2),
      outstanding: Number(r.outstanding_total).toFixed(2),
      overdue: Number(r.overdue_amount).toFixed(2),
      next_due_date: r.next_due_date ?? '',
      status: r.overall_status
    }));

    const filenameBase = `outstanding-fees-${new Date().toISOString().slice(0, 10)}`;

    if (format === 'xlsx') {
      const columns: ExportColumn[] = [
        { key: 'student_name', label: 'Student', width: 22 },
        { key: 'student_code', label: 'Student ID', width: 16 },
        { key: 'mobile', label: 'Mobile', width: 14 },
        { key: 'course', label: 'Course', width: 18 },
        { key: 'class', label: 'Class', width: 16 },
        { key: 'academic_year', label: 'Academic Year', width: 14 },
        { key: 'total_fee', label: 'Total Fee', width: 12 },
        { key: 'discount', label: 'Discount', width: 12 },
        { key: 'paid', label: 'Paid', width: 12 },
        { key: 'outstanding', label: 'Outstanding', width: 12 },
        { key: 'overdue', label: 'Overdue', width: 12 },
        { key: 'next_due_date', label: 'Next Due Date', width: 14 },
        { key: 'status', label: 'Status', width: 14 }
      ];
      const buffer = await toXlsx('Outstanding Fees', columns, rows);
      return new Response(Buffer.from(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filenameBase}.xlsx"`
        }
      });
    }

    if (format === 'pdf') {
      const columns: TableColumn[] = [
        { key: 'student_name', label: 'Student', width: 130 },
        { key: 'course', label: 'Course', width: 110 },
        { key: 'class', label: 'Class', width: 90 },
        { key: 'total_fee', label: 'Total', width: 70, align: 'right' },
        { key: 'paid', label: 'Paid', width: 70, align: 'right' },
        { key: 'outstanding', label: 'Outstanding', width: 80, align: 'right' },
        { key: 'overdue', label: 'Overdue', width: 70, align: 'right' },
        { key: 'next_due_date', label: 'Next Due', width: 80 },
        { key: 'status', label: 'Status', width: 90 }
      ];
      const bytes = await generateTablePdf(
        'COMETE LEARNING - Outstanding Fees',
        `Generated ${formatDate(new Date())} - ${rows.length} student(s)`,
        columns,
        rows.map((r) => ({
          ...r,
          total_fee: formatCurrencyForPdf(Number(r.total_fee)),
          paid: formatCurrencyForPdf(Number(r.paid)),
          outstanding: formatCurrencyForPdf(Number(r.outstanding)),
          overdue: formatCurrencyForPdf(Number(r.overdue)),
          next_due_date: r.next_due_date ? formatDate(r.next_due_date) : '-'
        }))
      );
      return new Response(Buffer.from(bytes), {
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filenameBase}.pdf"` }
      });
    }

    const columns: ExportColumn[] = [
      { key: 'student_name', label: 'Student' },
      { key: 'student_code', label: 'Student ID' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'course', label: 'Course' },
      { key: 'class', label: 'Class' },
      { key: 'academic_year', label: 'Academic Year' },
      { key: 'total_fee', label: 'Total Fee' },
      { key: 'discount', label: 'Discount' },
      { key: 'paid', label: 'Paid' },
      { key: 'outstanding', label: 'Outstanding' },
      { key: 'overdue', label: 'Overdue' },
      { key: 'next_due_date', label: 'Next Due Date' },
      { key: 'status', label: 'Status' }
    ];
    const csv = toCsv(columns, rows);
    return new Response(csv, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filenameBase}.csv"` }
    });
  } catch (error) {
    return apiError(error);
  }
}
