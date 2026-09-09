import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Permission, Profile, Role } from '@/lib/types/domain';

export interface SessionContext {
  userId: string;
  profile: Profile;
  role: Role;
  permissions: Set<Permission>;
  orgId: string;
}

/**
 * The single place that resolves "who is making this request and what are
 * they allowed to do". Every page and every API route that touches business
 * data should call this (directly or via requirePermission) BEFORE doing
 * anything else. This is defense-in-depth on top of Postgres RLS/RPC
 * permission checks - a user blocked here never even issues the query, and
 * a user who somehow got past this would still be blocked by the database.
 */
export async function getSession(): Promise<SessionContext | null> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  if (!profile || !profile.is_active) return null;

  const { data: role } = await supabase.from('roles').select('*').eq('id', profile.role_id).single();
  if (!role) return null;

  const { data: rolePerms } = await supabase.from('role_permissions').select('permission_key').eq('role_id', role.id);

  const permissions = new Set<Permission>((rolePerms ?? []).map((r) => r.permission_key as Permission));

  return {
    userId: user.id,
    profile: profile as Profile,
    role: role as Role,
    permissions,
    orgId: profile.org_id as string
  };
}

export class ForbiddenError extends Error {
  constructor(message = 'You do not have permission to do this.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class UnauthenticatedError extends Error {
  constructor(message = 'Please sign in to continue.') {
    super(message);
    this.name = 'UnauthenticatedError';
  }
}

/** Throws if there is no logged-in, active user. Returns the session otherwise. */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) throw new UnauthenticatedError();
  return session;
}

/** Throws if the current user lacks `permission`. Returns the session otherwise. */
export async function requirePermission(permission: Permission): Promise<SessionContext> {
  const session = await requireSession();
  if (!session.permissions.has(permission)) {
    throw new ForbiddenError(`This action requires the "${permission}" permission.`);
  }
  return session;
}

export function hasPermission(session: SessionContext | null, permission: Permission): boolean {
  return !!session?.permissions.has(permission);
}
