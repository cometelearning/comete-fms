import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';
import { DEFAULT_TEACHER_SHARE_PAYOUT_PERCENT } from '@/lib/settings/teacherShare';

export const runtime = 'nodejs';

const SETTINGS_KEY = 'teacher_share_payout_percent';

/**
 * Org-wide policy: of a teacher's computed nominal tuition share, what
 * fraction actually goes to the teacher - the rest stays with the
 * institute as ordinary tuition revenue (nothing further to record for
 * that remainder; it was already collected as a normal payment). Per the
 * user's explicit instruction ("only 60% of such shares belongs to
 * teachers, rest belongs to tuition itself"), stored as a single row in
 * the existing generic `settings` key-value table rather than a new
 * column, since it's one organization-wide value. Defaults to 60 when no
 * row exists yet, so nothing needs to be seeded by a migration.
 */
export async function GET() {
  try {
    const session = await requirePermission('settings.manage');
    const supabase = createClient();
    const { data } = await supabase.from('settings').select('value').eq('org_id', session.orgId).eq('key', SETTINGS_KEY).maybeSingle();
    const percent = typeof data?.value?.percent === 'number' ? data.value.percent : DEFAULT_TEACHER_SHARE_PAYOUT_PERCENT;
    return NextResponse.json({ data: { percent } });
  } catch (error) {
    return apiError(error);
  }
}

const schema = z.object({ percent: z.number().min(0).max(100) });

export async function PATCH(request: Request) {
  try {
    const session = await requirePermission('settings.manage');
    const body = schema.parse(await request.json());
    const supabase = createClient();

    const { data, error } = await supabase
      .from('settings')
      .upsert(
        { org_id: session.orgId, key: SETTINGS_KEY, value: { percent: body.percent }, updated_by: session.userId },
        { onConflict: 'org_id,key' }
      )
      .select()
      .single();
    if (error) throw error;

    await supabase.rpc('write_audit_log', {
      p_action: 'SETTINGS_UPDATED',
      p_module: 'settings',
      p_record_id: session.orgId,
      p_previous_value: null,
      p_new_value: { key: SETTINGS_KEY, ...body },
      p_reason: null
    });

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
