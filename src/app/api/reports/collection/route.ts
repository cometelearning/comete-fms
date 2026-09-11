import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';
import { buildCollectionQuery } from '@/lib/reports/collectionQuery';

export const runtime = 'nodejs';
const PAGE_SIZE = 30;

export async function GET(request: Request) {
  try {
    const session = await requirePermission('reports.view');
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));

    const query = buildCollectionQuery(
      supabase,
      {
        orgId: session.orgId,
        from: searchParams.get('from'),
        to: searchParams.get('to'),
        courseId: searchParams.get('course_id'),
        classId: searchParams.get('class_id'),
        paymentMode: searchParams.get('payment_mode'),
        createdBy: searchParams.get('created_by')
      },
      { count: 'exact' }
    );

    const { data, error, count } = await query.order('payment_date', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (error) throw error;

    // Grand total across the FULL filtered set (not just this page).
    const totalQuery = buildCollectionQuery(supabase, {
      orgId: session.orgId,
      from: searchParams.get('from'),
      to: searchParams.get('to'),
      courseId: searchParams.get('course_id'),
      classId: searchParams.get('class_id'),
      paymentMode: searchParams.get('payment_mode'),
      createdBy: searchParams.get('created_by')
    }).select('amount');
    const { data: allAmounts } = await totalQuery;
    const total = (allAmounts ?? []).reduce((sum: number, r: any) => sum + Number(r.amount), 0); // eslint-disable-line @typescript-eslint/no-explicit-any

    return NextResponse.json({ data, count, page, pageSize: PAGE_SIZE, total });
  } catch (error) {
    return apiError(error);
  }
}
