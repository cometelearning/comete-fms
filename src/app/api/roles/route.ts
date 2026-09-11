import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'role';
}

/**
 * Roles + the permission keys each one currently has, for the Users >
 * Roles & Permissions screen. `roles`/`role_permissions` RLS (migration
 * 0001/0003) already scopes everything to the caller's org, so this is a
 * plain read.
 */
export async function GET() {
  try {
    const session = await requirePermission('users.manage');
    const supabase = createClient();
    const { data, error } = await supabase
      .from('roles')
      .select('id, key, name, is_system, role_permissions(permission_key)')
      .eq('org_id', session.orgId)
      .order('is_system', { ascending: false })
      .order('name');
    if (error) throw error;

    const roles = (data ?? []).map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      is_system: r.is_system,
      permission_keys: (r.role_permissions ?? []).map((rp: { permission_key: string }) => rp.permission_key)
    }));

    return NextResponse.json({ data: roles });
  } catch (error) {
    return apiError(error);
  }
}

const insertSchema = z.object({ name: z.string().min(2) });

/**
 * Creates a new, non-system role with no permissions yet - the office ticks
 * boxes for it afterwards from the same screen (PUT
 * /api/roles/[id]/permissions). `key` is derived from the name and made
 * unique within the org by appending a numeric suffix on collision, since
 * roles.key has a `unique (org_id, key)` constraint.
 */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('users.manage');
    const body = insertSchema.parse(await request.json());
    const supabase = createClient();

    const base = slugify(body.name);
    const { data: existingKeys } = await supabase.from('roles').select('key').eq('org_id', session.orgId).like('key', `${base}%`);
    const taken = new Set((existingKeys ?? []).map((r) => r.key));
    let key = base;
    let n = 2;
    while (taken.has(key)) {
      key = `${base}_${n}`;
      n += 1;
    }

    const { data, error } = await supabase
      .from('roles')
      .insert({ org_id: session.orgId, key, name: body.name, is_system: false })
      .select()
      .single();
    if (error) throw error;

    await supabase.rpc('write_audit_log', {
      p_action: 'ROLE_CREATED',
      p_module: 'roles',
      p_record_id: data.id,
      p_previous_value: null,
      p_new_value: data,
      p_reason: null
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
