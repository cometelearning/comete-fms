import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requirePermission } from '@/lib/auth/session';
import { getGoogleAuthUrl } from '@/lib/google-drive/client';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await requirePermission('settings.manage');

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return NextResponse.redirect(
        new URL('/settings?drive_error=' + encodeURIComponent('Google Drive is not configured on this deployment yet. See README.md.'), process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')
      );
    }

    const state = randomBytes(16).toString('hex');
    const authUrl = getGoogleAuthUrl(state);

    const response = NextResponse.redirect(authUrl);
    response.cookies.set('gdrive_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' });
    return response;
  } catch (error) {
    return apiError(error);
  }
}
