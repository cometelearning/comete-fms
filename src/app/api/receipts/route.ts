import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

const PAGE_SIZE = 25;

/** The Receipt Register: every receipt, cancelled ones included. */
export async function GET(request: Request) {
  try {
    const session = await requirePermission('receipts.read');
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');
    const status = searchParams.get('status');
    const mode = searchParams.get('payment_mode');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const q = searchParams.get('q')?.trim();
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));

    let query = supabase
      .from('receipts')
      .select(
        'id, receipt_number, issued_at, status, pdf_status, cancellation_reason, payments!inner(amount, payment_mode, reference_number, payment_date, student_id, students(name, student_code, course_id, courses(name), batches(name))), profiles!receipts_created_by_fkey(full_name)',
        { count: 'exact' }
      )
      .eq('org_id', session.orgId);

    if (status) query = query.eq('status', status);
    if (from) query = query.gte('issued_at', from);
    if (to) query = query.lte('issued_at', to);
    if (mode) query = query.eq('payments.payment_mode', mode);
    if (studentId) query = query.eq('payments.student_id', studentId);
    if (q) query = query.ilike('receipt_number', `%${q}%`);

    query = query.order('issued_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ data, count, page, pageSize: PAGE_SIZE });
  } catch (error) {
    return apiError(error);
  }
}
