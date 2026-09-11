import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

const PAGE_SIZE = 25;

/** Lists all student fee accounts (with live totals) for the "Student Fees" overview screen. */
export async function GET(request: Request) {
  try {
    const session = await requirePermission('student_fees.read');
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const status = searchParams.get('status');
    const studentStatus = searchParams.get('student_status');
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));

    let query = supabase
      .from('student_fee_summary')
      .select('*, students!inner(name,student_code,status,classes(name)), fee_structures(name), academic_years(name)', { count: 'exact' })
      .eq('org_id', session.orgId);

    if (q) query = query.or(`name.ilike.%${q}%,student_code.ilike.%${q}%`, { foreignTable: 'students' });
    if (status) query = query.eq('overall_status', status);
    // Default-hide inactive students unless a filter specifically asks for
    // them (explicit user request).
    if (studentStatus !== 'ALL') query = query.eq('students.status', studentStatus || 'ACTIVE');

    query = query.order('student_id', { ascending: true }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ data, count, page, pageSize: PAGE_SIZE });
  } catch (error) {
    return apiError(error);
  }
}

const itemSchema = z.object({ fee_head_id: z.string().uuid(), amount: z.number().positive() });
const installmentSchema = z.object({
  seq_no: z.number().int().positive(),
  label: z.string().min(1),
  amount: z.number().positive(),
  due_date: z.string()
});

const schema = z.object({
  student_id: z.string().uuid(),
  items: z.array(itemSchema).min(1),
  installments: z.array(installmentSchema).min(1)
});

/**
 * Enters a fee directly for a student - no separate reusable "Fee
 * Structure" step. All the work (the fee record, its fee-head breakdown,
 * its installment schedule, the student's fee account, and the audit log)
 * happens inside the create_student_fee() Postgres function as one
 * transaction.
 */
export async function POST(request: Request) {
  try {
    await requirePermission('student_fees.write');
    const body = schema.parse(await request.json());
    const supabase = createClient();

    const { data, error } = await supabase.rpc('create_student_fee', {
      p_student_id: body.student_id,
      p_items: body.items,
      p_installments: body.installments
    });
    if (error) throw error;

    return NextResponse.json({ data: { student_fee_account_id: data } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
