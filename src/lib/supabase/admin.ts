import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client. BYPASSES Row Level Security entirely.
 *
 * `import 'server-only'` makes any accidental import from a Client Component
 * fail the build instead of silently leaking the service-role key to the
 * browser bundle.
 *
 * Use this ONLY for the small set of operations that must run outside a
 * user's own permissions, e.g.:
 *   - creating a new auth user + profile when a Super Admin adds a teammate
 *   - the one-time organization bootstrap flow
 *   - reading/writing the encrypted Google Drive refresh token
 *   - server-side scheduled backups
 * Every other query in the app should use lib/supabase/server.ts so that
 * Postgres RLS (not just application code) enforces who can see/change what.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase service role is not configured (missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).');
  }

  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
