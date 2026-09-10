import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';
import { buildStudentRecordQuery, fetchStudentFeeTotals } from '@/lib/reports/studentRecordQuery';
import { resolveClassToCourseIds } from '@/lib/reports/classFilter';
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
    const courseIds = await resolveClassToCourseIds(supabase, session.orgId, searchParams.get('class_standard'));

    const query = buildStudentRecordQuery(supabase, {
      orgId: session.orgId,
      academicYearId: searchParams.get('academic_year_id'),
      courseId: searchParams.get('course_id'),
      courseIds,
      status: searchParams.get('status'),
      q: searchParams.get('q')
    });

    const { data, error } = await query.order('name', { ascending: true }).limit(EXPORT_LIMIT);
    if (error) throw error;

    const totals = await fetchStudentFeeTotals(supabase, session.orgId, (data ?? []).map((s) => s.id));

    const rows = (data ?? []).map((s: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const t = totals.get(s.id) ?? { totalFee: 0, paidTotal: 0, outstandingTotal: 0 };
      return {
        student_code: s.student_code,
        admission_number: s.admission_number ?? '',
        name: s.name,
        mobile: s.student_mobile ?? s.parent_mobile ?? '',
        course: s.courses?.name ?? '',
        class: s.courses?.class_standard ?? '',
        academic_year: s.academic_years?.name ?? '',
        status: s.status,
        total_fee: t.totalFee.toFixed(2),
        paid: t.paidTotal.toFixed(2),
        outstanding: t.outstandingTotal.toFixed(2)
      };
    });

    const filenameBase = `student-record-${new Date().toISOString().slice(0, 10)}`;

    if (format === 'xlsx') {
      const columns: ExportColumn[] = [
        { key: 'student_code', label: 'Student ID', width: 16 },
        { key: 'admission_number', label: 'Admission No.', width: 16 },
        { key: 'name', label: 'Student', width: 22 },
        { key: 'mobile', label: 'Mobile', width: 14 },
        { key: 'course', label: 'Course', width: 18 },
        { key: 'class', label: 'Class', width: 14 },
        { key: 'academic_year', label: 'Academic Year', width: 14 },
        { key: 'status', label: 'Status', width: 12 },
        { key: 'total_fee', label: 'Total Fee', width: 12 },
        { key: 'paid', label: 'Paid', width: 12 },
        { key: 'outstanding', label: 'Outstanding', width: 12 }
      ];
      const buffer = await toXlsx('Student Record', columns, rows);
      return new Response(Buffer.from(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filenameBase}.xlsx"`
        }
      });
    }

    if (format === 'pdf') {
      const columns: TableColumn[] = [
        { key: 'name', label: 'Student', width: 120 },
        { key: 'student_code', label: 'Student ID', width: 90 },
        { key: 'course', label: 'Course', width: 90 },
        { key: 'class', label: 'Class', width: 60 },
        { key: 'total_fee', label: 'Total', width: 70, align: 'right' },
        { key: 'paid', label: 'Paid', width: 70, align: 'right' },
        { key: 'outstanding', label: 'Outstanding', width: 80, align: 'right' },
        { key: 'status', label: 'Status', width: 80 }
      ];
      const bytes = await generateTablePdf(
        'COMETE LEARNING - Student Record',
        `Generated ${formatDate(new Date())} - ${rows.length} student(s)`,
        columns,
        rows.map((r) => ({
          ...r,
          total_fee: formatCurrency(Number(r.total_fee)),
          paid: formatCurrency(Number(r.paid)),
          outstanding: formatCurrency(Number(r.outstanding))
        }))
      );
      return new Response(Buffer.from(bytes), {
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filenameBase}.pdf"` }
      });
    }

    const columns: ExportColumn[] = [
      { key: 'student_code', label: 'Student ID' },
      { key: 'admission_number', label: 'Admission No.' },
      { key: 'name', label: 'Student' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'course', label: 'Course' },
      { key: 'class', label: 'Class' },
      { key: 'academic_year', label: 'Academic Year' },
      { key: 'status', label: 'Status' },
      { key: 'total_fee', label: 'Total Fee' },
      { key: 'paid', label: 'Paid' },
      { key: 'outstanding', label: 'Outstanding' }
    ];
    const csv = toCsv(columns, rows);
    return new Response(csv, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filenameBase}.csv"` }
    });
  } catch (error) {
    return apiError(error);
  }
}
