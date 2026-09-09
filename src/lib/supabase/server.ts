import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Server-side Supabase client bound to the current request's cookies.
 * Every query made with this client is subject to Row Level Security as the
 * logged-in user (auth.uid()) -- this is the client almost everything in the
 * app should use.
 *
 * Deliberately untyped (no <Database> generic): a hand-written schema type
 * covering every table/view/function fights supabase-js's generics more
 * than it helps. Once deployed, run
 *   npx supabase gen types typescript --project-id <ref>
 * and pass the generated type here for full compile-time safety - see
 * README.md "Keeping types in sync". Until then, src/lib/types/domain.ts
 * defines the shapes the application actually codes against.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Called from a Server Component with no request context to
            // write to - middleware.ts refreshes the session instead.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // See note above.
          }
        }
      }
    }
  );
}
