'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client. Only ever uses the public anon key - RLS applies
 * exactly as it does server-side, so this is safe to ship to the client.
 * Deliberately untyped - see the note in lib/supabase/server.ts.
 */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
