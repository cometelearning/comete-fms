import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

// General edit only - subject/date/topic/level. `status`/`checked_at`/
// `checked_by` are deliberately NOT here, same "separate route, stripped
// from the general schema" pattern as students.status (migration 0019) -
// see POST .../check/route.ts, which is the only path that can mark a slip
// checked, and sets those fields itself rather than trusting the client.
const updateSchema = z.object({
  subject_id: z.string().uuid().optional(),
  slip_date: z.string().min(1).optional(),
  topic: z.string().min(1).optional(),
  level: z.enum(['LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'NA']).optional()
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('students.write');
    const body = updateSchema.parse(await request.json());
    const supabase = createClient();

    const { data: previous } = await supabase.from('practice_slips').select('*').eq('id', params.id).eq('org_id', session.orgId).single();

    const { data, error } = await supabase
      .from('practice_slips')
      .update(body)
      .eq('id', params.id)
      .eq('org_id', session.orgId)
      .select()
      .single();
    if (error) throw error;

    await supabase.rpc('write_audit_log', {
      p_action: 'PRACTICE_SLIP_UPDATED',
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
