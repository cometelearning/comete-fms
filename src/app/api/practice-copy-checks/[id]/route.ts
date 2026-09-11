import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

const updateSchema = z.object({
  check_date: z.string().min(1).optional(),
  teacher_id: z.string().uuid().optional(),
  remarks: z.string().optional().nullable()
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('students.write');
    const body = updateSchema.parse(await request.json());
    const supabase = createClient();

    const { data: previous } = await supabase
      .from('practice_copy_checks')
      .select('*')
      .eq('id', params.id)
      .eq('org_id', session.orgId)
      .single();

    const { data, error } = await supabase
      .from('practice_copy_checks')
      .update(body)
      .eq('id', params.id)
      .eq('org_id', session.orgId)
      .select()
      .single();
    if (error) throw error;

    await supabase.rpc('write_audit_log', {
      p_action: 'PRACTICE_COPY_CHECK_UPDATED',
      p_module: 'practice_copy_checks',
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
