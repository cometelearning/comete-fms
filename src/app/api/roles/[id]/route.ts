import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

const updateSchema = z.object({ name: z.string().min(2) });

/**
 * Renames a role. System roles (Super Admin/Admin/Accountant/Management-
 * Viewer, plus Teacher as of migration 0018) cannot be renamed - RLS
 * (`roles_update`, migration 0003) already enforces `is_system = false` at
 * the database level, but this pre-checks it for a friendly message instead
 * of a raw RLS failure.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('users.manage');
    const body = updateSchema.parse(await request.json());
    const supabase = createClient();

    const { data: role } = await supabase.from('roles').select('*').eq('id', params.id).eq('org_id', session.orgId).single();
    if (!role) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'That role could not be found.' }, { status: 404 });
    }
    if (role.is_system) {
      return NextResponse.json({ error: 'CANNOT_MODIFY_SYSTEM_ROLE', message: 'Built-in roles cannot be renamed.' }, { status: 422 });
    }

    const { data, error } = await supabase.from('roles').update({ name: body.name }).eq('id', params.id).eq('org_id', session.orgId).select().single();
    if (error) throw error;

    await supabase.rpc('write_audit_log', {
      p_action: 'ROLE_RENAMED',
      p_module: 'roles',
      p_record_id: params.id,
      p_previous_value: { name: role.name },
      p_new_value: { name: data.name },
      p_reason: null
    });

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Deletes a role. Blocked for system roles (same reasoning as PATCH above)
 * and for any role still assigned to one or more users - `profiles.role_id`
 * has no ON DELETE behaviour set (defaults to RESTRICT), so an in-use role
 * would fail at the database level anyway; this pre-check just gives a
 * clear message instead of a raw foreign-key error.
 */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('users.manage');
    const supabase = createClient();

    const { data: role } = await supabase.from('roles').select('*').eq('id', params.id).eq('org_id', session.orgId).single();
    if (!role) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'That role could not be found.' }, { status: 404 });
    }
    if (role.is_system) {
      return NextResponse.json({ error: 'CANNOT_MODIFY_SYSTEM_ROLE', message: 'Built-in roles cannot be deleted.' }, { status: 422 });
    }

    const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role_id', params.id);
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: 'ROLE_IN_USE', message: `This role is assigned to ${count} user(s). Reassign them to a different role first.` },
        { status: 422 }
      );
    }

    const { error } = await supabase.from('roles').delete().eq('id', params.id).eq('org_id', session.orgId);
    if (error) throw error;

    await supabase.rpc('write_audit_log', {
      p_action: 'ROLE_DELETED',
      p_module: 'roles',
      p_record_id: params.id,
      p_previous_value: role,
      p_new_value: null,
      p_reason: null
    });

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    return apiError(error);
  }
}
