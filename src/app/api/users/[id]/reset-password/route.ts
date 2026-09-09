import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';
import { generateTempPassword } from '@/lib/utils/password';

export const runtime = 'nodejs';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('users.manage');
    const supabase = createClient();
    const admin = createAdminClient();

    const { data: profile } = await supabase.from('profiles').select('id').eq('id', params.id).eq('org_id', session.orgId).single();
    if (!profile) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'User not found.' }, { status: 404 });
    }

    const tempPassword = generateTempPassword();
    const { error } = await admin.auth.admin.updateUserById(params.id, { password: tempPassword });
    if (error) throw error;

    await supabase.rpc('write_audit_log', {
      p_action: 'USER_PASSWORD_RESET',
      p_module: 'users',
      p_record_id: params.id,
      p_previous_value: null,
      p_new_value: null,
      p_reason: null
    });

    return NextResponse.json({ data: { tempPassword } });
  } catch (error) {
    return apiError(error);
  }
}
