import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

const updateSchema = z.object({
  full_name: z.string().min(2).optional(),
  mobile: z.string().optional().nullable(),
  role_id: z.string().uuid().optional(),
  is_active: z.boolean().optional()
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('users.manage');
    const body = updateSchema.parse(await request.json());
    const supabase = createClient();

    if (params.id === session.userId && body.is_active === false) {
      return NextResponse.json({ error: 'CANNOT_DISABLE_SELF', message: 'You cannot disable your own account.' }, { status: 422 });
    }

    const { data: previous } = await supabase.from('profiles').select('*').eq('id', params.id).eq('org_id', session.orgId).single();

    const { data, error } = await supabase.from('profiles').update(body).eq('id', params.id).eq('org_id', session.orgId).select().single();
    if (error) throw error;

    await supabase.rpc('write_audit_log', {
      p_action: body.is_active === false ? 'USER_DISABLED' : body.is_active === true ? 'USER_ENABLED' : 'USER_UPDATED',
      p_module: 'users',
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
