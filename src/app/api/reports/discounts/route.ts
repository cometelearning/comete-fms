import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';
const PAGE_SIZE = 30;

export async function GET(request: Request) {
  try {
    const session = await requirePermission('reports.view');
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const grantedBy = searchParams.get('granted_by');
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));

    let query = supabase
      .from('discounts')
      .select(
        '*, student_fee_accounts(students(name, student_code)), profiles!discounts_granted_by_fkey(full_name)',
        { count: 'exact' }
      )
      .eq('org_id', session.orgId);

    if (status) query = query.eq('status', status);
    if (grantedBy) query = query.eq('granted_by', grantedBy);

    query = query.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ data, count, page, pageSize: PAGE_SIZE });
  } catch (error) {
    return apiError(error);
  }
}
