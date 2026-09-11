import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

// Not built on the generic createItemHandlers() factory (unlike the other
// master tables) because class_id needs special handling: it must stay
// entirely absent from the parsed body when the caller didn't send it at
// all (e.g. the Activate/Deactivate button only PATCHes { status }), but
// become null when the Course form submits it as '' (no class selected). A
// zod .transform() on an optional field can't tell those two cases apart -
// it forces the field into the output either way - so the '' -> null
// conversion is done explicitly below, only when the key is actually
// present. class_standard is never accepted from the client: it's derived
// from class_id by a database trigger (migration 0011).
//
// class_id stays .optional() here (unlike the POST insertSchema, which
// requires it outright) purely so the Activate/Deactivate `{status}`-only
// PATCH keeps working - Class is still required in practice on every real
// edit, because the Edit Course form's `required` select attribute won't
// submit the form without one.
const updateSchema = z.object({
  name: z.string().min(1).optional(),
  class_id: z.string().uuid().optional().or(z.literal('')),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional()
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('masters.write');
    const parsed = updateSchema.parse(await request.json());
    const update: Record<string, unknown> = { ...parsed };
    if (update.class_id === '') update.class_id = null;

    const supabase = createClient();
    const { data: previous } = await supabase.from('courses').select('*').eq('id', params.id).eq('org_id', session.orgId).single();
    const { data, error } = await supabase
      .from('courses')
      .update(update)
      .eq('id', params.id)
      .eq('org_id', session.orgId)
      .select()
      .single();
    if (error) throw error;

    await supabase.rpc('write_audit_log', {
      p_action: 'COURSES_UPDATED',
      p_module: 'courses',
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
