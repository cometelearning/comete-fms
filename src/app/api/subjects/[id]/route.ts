import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  class_ids: z.array(z.string().uuid()).min(1, 'Select at least one class.').optional()
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('masters.write');
    const body = updateSchema.parse(await request.json());
    const supabase = createClient();

    const { data: previous } = await supabase
      .from('subjects')
      .select('*, subject_classes(class_id)')
      .eq('id', params.id)
      .eq('org_id', session.orgId)
      .single();

    const { name, status } = body;
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (status !== undefined) patch.status = status;

    let data = previous;
    if (Object.keys(patch).length > 0) {
      const { data: updated, error } = await supabase
        .from('subjects')
        .update(patch)
        .eq('id', params.id)
        .eq('org_id', session.orgId)
        .select()
        .single();
      if (error) throw error;
      data = updated;
    }

    if (body.class_ids) {
      const { error: deleteError } = await supabase.from('subject_classes').delete().eq('subject_id', params.id).eq('org_id', session.orgId);
      if (deleteError) throw deleteError;
      const { error: insertError } = await supabase
        .from('subject_classes')
        .insert(body.class_ids.map((class_id) => ({ org_id: session.orgId, subject_id: params.id, class_id })));
      if (insertError) throw insertError;
    }

    await supabase.rpc('write_audit_log', {
      p_action: 'SUBJECTS_UPDATED',
      p_module: 'subjects',
      p_record_id: params.id,
      p_previous_value: previous ?? null,
      p_new_value: { ...data, class_ids: body.class_ids },
      p_reason: null
    });
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
