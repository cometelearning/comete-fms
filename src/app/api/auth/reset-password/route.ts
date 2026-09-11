import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

const bodySchema = z.object({ token: z.string().min(1), password: z.string().min(8, 'Password must be at least 8 characters.') });

/**
 * Public (unauthenticated) route - redeems a forgot-password token minted
 * by POST /api/auth/forgot-password. Uses the admin client throughout,
 * since there is no session yet. The raw token is never stored - only its
 * SHA-256 hash - so a leaked database (or a compromised backup) can't be
 * used to forge a working reset link.
 */
export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const admin = createAdminClient();

    const tokenHash = createHash('sha256').update(body.token).digest('hex');
    const { data: tokenRow } = await admin
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    const valid = tokenRow && !tokenRow.used_at && new Date(tokenRow.expires_at) > new Date();
    if (!valid) {
      return NextResponse.json(
        { error: 'INVALID_OR_EXPIRED_TOKEN', message: 'This reset link is invalid or has expired. Please request a new one.' },
        { status: 422 }
      );
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(tokenRow.user_id, { password: body.password });
    if (updateError) throw updateError;

    // Consume this token, and any other still-unused ones for the same
    // user, so an older emailed link can't also be redeemed afterwards.
    await admin.from('password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('user_id', tokenRow.user_id).is('used_at', null);

    const { data: profile } = await admin.from('profiles').select('org_id, email').eq('id', tokenRow.user_id).single();
    if (profile) {
      // No session exists for write_audit_log()'s auth.uid()/current_org_id()
      // to resolve, so this is a direct insert (service role bypasses RLS)
      // rather than the usual RPC - see migration 0018's write-up.
      await admin.from('audit_logs').insert({
        org_id: profile.org_id,
        user_id: tokenRow.user_id,
        user_email: profile.email,
        action: 'PASSWORD_RESET_VIA_LINK',
        module: 'auth',
        record_id: tokenRow.user_id,
        previous_value: null,
        new_value: null,
        reason: null
      });
    }

    return NextResponse.json({ data: { reset: true } });
  } catch (error) {
    return apiError(error);
  }
}
