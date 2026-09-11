import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

/**
 * "An action button be given to this so that in next few days, teacher
 * shall mark as the practice slip checked and completed" - the only path
 * that can move a slip to CHECKED. checked_at/checked_by are always set
 * server-side (never trust a client-supplied timestamp/user), same
 * discipline as receipt cancellation and the student status route.
 * Idempotent by design (re-marking an already-checked slip just refreshes
 * checked_at/checked_by) rather than erroring, since this is a simple
 * office action with no financial effect to protect against double-apply.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('students.write');
    const supabase = createClient();

    const { data: previous } = await supabase.from('practice_slips').select('*').eq('id', params.id).eq('org_id', session.orgId).single();

    const { data, error } = await supabase
      .from('practice_slips')
      .update({ status: 'CHECKED', checked_at: new Date().toISOString(), checked_by: session.userId })
      .eq('id', params.id)
      .eq('org_id', session.orgId)
      .select()
      .single();
    if (error) throw error;

    await supabase.rpc('write_audit_log', {
      p_action: 'PRACTICE_SLIP_CHECKED',
      p_module: 'practice_slips',
      p_record_id: params.id,
      p_previous_value: previous ?? null,
      p_new_value: data,
      p_reason: null
    });

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
