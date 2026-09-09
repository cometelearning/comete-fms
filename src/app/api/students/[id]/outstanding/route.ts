import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

/**
 * Everything the Collect Fee screen needs for one student: each fee account
 * with its live summary, and every installment's live status - all computed
 * from student_fee_summary / installment_status (never a stored balance).
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('student_fees.read');
    const supabase = createClient();

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id,name,student_code,status')
      .eq('id', params.id)
      .eq('org_id', session.orgId)
      .single();
    if (studentError) throw studentError;

    const { data: accounts, error: accountsError } = await supabase
      .from('student_fee_summary')
      .select('*, fee_structures(name)')
      .eq('student_id', params.id);
    if (accountsError) throw accountsError;

    const accountIds = (accounts ?? []).map((a) => a.student_fee_account_id);
    let installments: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (accountIds.length > 0) {
      const { data: instData, error: instError } = await supabase
        .from('installment_status')
        .select('*')
        .in('student_fee_account_id', accountIds)
        .order('due_date', { ascending: true });
      if (instError) throw instError;
      installments = instData ?? [];
    }

    const result = (accounts ?? []).map((a) => ({
      ...a,
      installments: installments.filter((i) => i.student_fee_account_id === a.student_fee_account_id)
    }));

    return NextResponse.json({ data: { student, accounts: result } });
  } catch (error) {
    return apiError(error);
  }
}
