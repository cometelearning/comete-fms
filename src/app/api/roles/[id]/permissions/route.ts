import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

const updateSchema = z.object({ permission_keys: z.array(z.string()) });

/**
 * Replaces a role's ENTIRE permission set (delete + reinsert), the same
 * "replace the full set" pattern used for a Course's tagged classes
 * (migration 0016's `course_classes`) - simpler and less error-prone than a
 * one-permission-at-a-time toggle endpoint, and the Roles & Permissions
 * screen always has the complete desired set in hand when it saves.
 *
 * Super Admin's permission set can never be changed via this route (checked
 * by role key, not is_system, since Admin/Accountant/Management-Viewer/
 * Teacher ARE meant to be adjustable even though 3 of them are system
 * roles) - the spec guarantees Super Admin "complete access" unconditionally,
 * and letting that be edited away from the UI risks an org locking itself
 * out of user management entirely.
 */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('users.manage');
    const body = updateSchema.parse(await request.json());
    const supabase = createClient();

    const { data: role } = await supabase.from('roles').select('*').eq('id', params.id).eq('org_id', session.orgId).single();
    if (!role) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'That role could not be found.' }, { status: 404 });
    }
    if (role.key === 'super_admin') {
      return NextResponse.json(
        { error: 'CANNOT_MODIFY_SUPER_ADMIN', message: 'Super Admin always has every permission and cannot be changed.' },
        { status: 422 }
      );
    }

    const { data: previous } = await supabase.from('role_permissions').select('permission_key').eq('role_id', params.id);
    const previousKeys = (previous ?? []).map((r) => r.permission_key);

    const { error: deleteError } = await supabase.from('role_permissions').delete().eq('role_id', params.id);
    if (deleteError) throw deleteError;

    const uniqueKeys = Array.from(new Set(body.permission_keys));
    if (uniqueKeys.length > 0) {
      const { error: insertError } = await supabase
        .from('role_permissions')
        .insert(uniqueKeys.map((key) => ({ role_id: params.id, permission_key: key })));
      if (insertError) throw insertError;
    }

    await supabase.rpc('write_audit_log', {
      p_action: 'ROLE_PERMISSIONS_UPDATED',
      p_module: 'roles',
      p_record_id: params.id,
      p_previous_value: { permission_keys: previousKeys },
      p_new_value: { permission_keys: uniqueKeys },
      p_reason: null
    });

    return NextResponse.json({ data: { permission_keys: uniqueKeys } });
  } catch (error) {
    return apiError(error);
  }
}
