import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';
import { buildStudentRecordQuery, fetchStudentFeeTotals } from '@/lib/reports/studentRecordQuery';

export const runtime = 'nodejs';
const PAGE_SIZE = 30;

export async function GET(request: Request) {
  try {
    const session = await requirePermission('reports.view');
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));

    const query = buildStudentRecordQuery(
      supabase,
      {
        orgId: session.orgId,
        academicYearId: searchParams.get('academic_year_id'),
        courseId: searchParams.get('course_id'),
        classId: searchParams.get('class_id'),
        branchId: searchParams.get('branch_id'),
        batchId: searchParams.get('batch_id'),
        boardId: searchParams.get('board_id'),
        status: searchParams.get('status'),
        q: searchParams.get('q')
      },
      { count: 'exact' }
    );

    const { data, error, count } = await query.order('name', { ascending: true }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (error) throw error;

    const totals = await fetchStudentFeeTotals(supabase, session.orgId, (data ?? []).map((s) => s.id));
    const rows = (data ?? []).map((s) => ({
      ...s,
      fee_totals: totals.get(s.id) ?? { totalFee: 0, paidTotal: 0, outstandingTotal: 0 }
    }));

    return NextResponse.json({ data: rows, count, page, pageSize: PAGE_SIZE });
  } catch (error) {
    return apiError(error);
  }
}
