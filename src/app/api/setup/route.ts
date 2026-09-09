import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

const schema = z.object({
  orgName: z.string().min(2),
  orgEmail: z.string().email().optional().or(z.literal('')),
  orgPhone: z.string().optional(),
  orgAddress: z.string().optional(),
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8, 'Password must be at least 8 characters.'),
  adminMobile: z.string().optional()
});

/**
 * One-time organization bootstrap. Only works while zero organizations
 * exist - once COMETE LEARNING is set up, this route always returns 409 and
 * new users must be created from Settings -> Users by a Super Admin instead.
 * Uses the service-role client because there is no logged-in user yet.
 */
export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const admin = createAdminClient();

    const { count, error: countError } = await admin.from('organizations').select('*', { count: 'exact', head: true });
    if (countError) throw countError;
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: 'ALREADY_SET_UP', message: 'COMETE LEARNING is already set up. Please sign in, or ask a Super Admin to create your account from Users.' },
        { status: 409 }
      );
    }

    const { data: orgId, error: bootstrapError } = await admin.rpc('bootstrap_organization', {
      p_name: body.orgName,
      p_email: body.orgEmail || null,
      p_phone: body.orgPhone || null,
      p_address: body.orgAddress || null
    });
    if (bootstrapError) throw bootstrapError;

    const { data: superAdminRole, error: roleError } = await admin
      .from('roles')
      .select('id')
      .eq('org_id', orgId)
      .eq('key', 'super_admin')
      .single();
    if (roleError) throw roleError;

    const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
      email: body.adminEmail,
      password: body.adminPassword,
      email_confirm: true
    });
    if (createUserError) throw createUserError;

    const { error: profileError } = await admin.from('profiles').insert({
      id: createdUser.user.id,
      org_id: orgId,
      full_name: body.adminName,
      email: body.adminEmail,
      mobile: body.adminMobile || null,
      role_id: superAdminRole.id,
      is_active: true
    });
    if (profileError) throw profileError;

    return NextResponse.json({ success: true, orgId });
  } catch (error) {
    return apiError(error);
  }
}

/** Lets the /setup page know whether setup has already been completed. */
export async function GET() {
  try {
    const admin = createAdminClient();
    const { count, error } = await admin.from('organizations').select('*', { count: 'exact', head: true });
    if (error) throw error;
    return NextResponse.json({ setupComplete: (count ?? 0) > 0 });
  } catch (error) {
    return apiError(error);
  }
}
