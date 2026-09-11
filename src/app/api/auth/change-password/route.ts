import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters.')
});

/**
 * Self-service "change my password" for a logged-in user (migration 0018) -
 * distinct from the admin-side reset on the Users tab. Requires the
 * current password even though the request already carries a valid
 * session, as a deliberate extra check: a session alone doesn't prove the
 * person at the keyboard right now is the account owner (e.g. an unlocked,
 * still-signed-in browser left unattended).
 */
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = bodySchema.parse(await request.json());

    // Verify the current password with a throwaway, non-persisting client
    // (anon key, same as the login page) rather than the cookie-bound one,
    // so this check can never disturb the caller's actual session cookies.
    const verifier = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { error: verifyError } = await verifier.auth.signInWithPassword({ email: session.profile.email, password: body.currentPassword });
    if (verifyError) {
      return NextResponse.json({ error: 'INCORRECT_PASSWORD', message: 'Current password is incorrect.' }, { status: 422 });
    }

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: body.newPassword });
    if (updateError) throw updateError;

    await supabase.rpc('write_audit_log', {
      p_action: 'PASSWORD_CHANGED_SELF',
      p_module: 'auth',
      p_record_id: session.userId,
      p_previous_value: null,
      p_new_value: null,
      p_reason: null
    });

    return NextResponse.json({ data: { changed: true } });
  } catch (error) {
    return apiError(error);
  }
}
