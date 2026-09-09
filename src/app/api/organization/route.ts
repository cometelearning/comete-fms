import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await requirePermission('settings.manage');
    const supabase = createClient();
    const { data, error } = await supabase.from('organizations').select('*').eq('id', session.orgId).single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}

const schema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal(''))
});

export async function PATCH(request: Request) {
  try {
    const session = await requirePermission('settings.manage');
    const body = schema.parse(await request.json());
    const supabase = createClient();

    const { data: previous } = await supabase.from('organizations').select('*').eq('id', session.orgId).single();
    const { data, error } = await supabase.from('organizations').update(body).eq('id', session.orgId).select().single();
    if (error) throw error;

    await supabase.rpc('write_audit_log', {
      p_action: 'SETTINGS_UPDATED',
      p_module: 'settings',
      p_record_id: session.orgId,
      p_previous_value: previous ?? null,
      p_new_value: data,
      p_reason: null
    });

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
