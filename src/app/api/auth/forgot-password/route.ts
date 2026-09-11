import { NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiError } from '@/lib/api/handler';
import { isEmailConfigured } from '@/lib/email/mailer';
import { sendPasswordResetEmail } from '@/lib/email/sendPasswordResetEmail';

export const runtime = 'nodejs';

const RESET_TOKEN_TTL_MINUTES = 30;
const RESEND_COOLDOWN_MINUTES = 2;

const bodySchema = z.object({ email: z.string().email() });

/**
 * Public (unauthenticated) route - a person who is locked out has, by
 * definition, no session. Uses the admin (service-role) client throughout,
 * since there is no logged-in user for RLS to scope to.
 *
 * Deliberately never reveals whether a given email exists: the response
 * shape is the same either way (data.emailConfigured only), and the actual
 * lookup/token/email happens silently in the background of a 200 response.
 * The one thing that IS surfaced truthfully is whether SMTP has been set up
 * at all (`emailConfigured`) - that's an operational fact about this
 * deployment, not a secret about any particular user, and telling the
 * person "ask your Super Admin instead" when the flow genuinely can't work
 * is more useful than a generic message that goes nowhere.
 */
export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const emailConfigured = isEmailConfigured();

    if (emailConfigured) {
      const admin = createAdminClient();
      const { data: profile } = await admin.from('profiles').select('id, full_name, email').eq('email', body.email).eq('is_active', true).maybeSingle();

      if (profile) {
        // Light rate limit: don't issue a second token (or send a second
        // email) if one was already requested very recently for this user.
        const { data: recent } = await admin
          .from('password_reset_tokens')
          .select('id')
          .eq('user_id', profile.id)
          .is('used_at', null)
          .gt('created_at', new Date(Date.now() - RESEND_COOLDOWN_MINUTES * 60_000).toISOString())
          .limit(1);

        if (!recent || recent.length === 0) {
          const rawToken = randomBytes(32).toString('hex');
          const tokenHash = createHash('sha256').update(rawToken).digest('hex');
          const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000).toISOString();

          const { error: insertError } = await admin
            .from('password_reset_tokens')
            .insert({ user_id: profile.id, token_hash: tokenHash, expires_at: expiresAt });

          if (!insertError) {
            const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
            const resetUrl = `${base}/reset-password?token=${rawToken}`;
            try {
              await sendPasswordResetEmail({ to: profile.email, fullName: profile.full_name, resetUrl });
            } catch {
              // Swallow - never let a transient email-provider failure leak
              // whether this address exists, or block the generic response.
            }
          }
        }
      }
    }

    return NextResponse.json({ data: { emailConfigured } });
  } catch (error) {
    return apiError(error);
  }
}
