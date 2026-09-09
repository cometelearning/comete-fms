import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';
import { generateTempPassword } from '@/lib/utils/password';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await requirePermission('users.manage');
    const supabase = createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*, roles(name,key)')
      .eq('org_id', session.orgId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}

const insertSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  mobile: z.string().optional(),
  role_id: z.string().uuid()
});

/**
 * Creates a teammate's login. Every employee gets their own account (spec
 * #5) - there is no shared username/password. A random temporary password
 * is generated and returned ONCE in the response for the Super Admin to
 * share securely; it is never stored in plain text or logged.
 */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('users.manage');
    const body = insertSchema.parse(await request.json());
    const admin = createAdminClient();
    const supabase = createClient();

    const { data: role } = await supabase.from('roles').select('id').eq('id', body.role_id).eq('org_id', session.orgId).single();
    if (!role) {
      return NextResponse.json({ error: 'INVALID_ROLE', message: 'That role does not exist.' }, { status: 422 });
    }

    const tempPassword = generateTempPassword();
    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email: body.email,
      password: tempPassword,
      email_confirm: true
    });
    if (createError) throw createError;

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .insert({
        id: createdUser.user.id,
        org_id: session.orgId,
        full_name: body.full_name,
        email: body.email,
        mobile: body.mobile || null,
        role_id: body.role_id,
        is_active: true
      })
      .select()
      .single();
    if (profileError) throw profileError;

    await supabase.rpc('write_audit_log', {
      p_action: 'USER_CREATED',
      p_module: 'users',
      p_record_id: profile.id,
      p_previous_value: null,
      p_new_value: { full_name: body.full_name, email: body.email, role_id: body.role_id },
      p_reason: null
    });

    return NextResponse.json({ data: { profile, tempPassword } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
