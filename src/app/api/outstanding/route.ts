import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';
import { buildOutstandingQuery } from '@/lib/reports/outstandingQuery';

export const runtime = 'nodejs';
const PAGE_SIZE = 25;

export async function GET(request: Request) {
  try {
    const session = await requirePermission('outstanding.view');
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));

    const query = buildOutstandingQuery(
      supabase,
      {
        orgId: session.orgId,
        academicYearId: searchParams.get('academic_year_id'),
        courseId: searchParams.get('course_id'),
        classId: searchParams.get('class_id'),
        q: searchParams.get('q'),
        overdueOnly: searchParams.get('overdue_only') === 'true',
        minAmount: searchParams.get('min_amount') ? Number(searchParams.get('min_amount')) : null
      },
      { count: 'exact' }
    );

    const { data, error, count } = await query
      .order('outstanding_total', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (error) throw error;

    return NextResponse.json({ data, count, page, pageSize: PAGE_SIZE });
  } catch (error) {
    return apiError(error);
  }
}
