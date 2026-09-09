import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requirePermission('student_fees.read');
    const supabase = createClient();
    const { data, error } = await supabase
      .from('installment_status')
      .select('*')
      .eq('student_fee_account_id', params.id)
      .order('due_date', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
