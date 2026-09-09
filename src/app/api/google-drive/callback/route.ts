import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth/session';
import { exchangeCodeAndStore } from '@/lib/google-drive/client';

export const runtime = 'nodejs';

function redirectWithMessage(base: string, param: 'drive_connected' | 'drive_error', message: string) {
  const url = new URL('/settings', base);
  url.searchParams.set(param, message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const session = await getSession();
  if (!session || !session.permissions.has('settings.manage')) {
    return redirectWithMessage(base, 'drive_error', 'You do not have permission to connect Google Drive.');
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const storedState = cookies().get('gdrive_oauth_state')?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return redirectWithMessage(base, 'drive_error', 'The connection request could not be verified. Please try connecting again.');
  }

  try {
    const { email } = await exchangeCodeAndStore(session.orgId, code, session.userId);
    return redirectWithMessage(base, 'drive_connected', `Connected as ${email}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not connect Google Drive.';
    return redirectWithMessage(base, 'drive_error', message.replace(/^GOOGLE_NO_REFRESH_TOKEN: /, ''));
  }
}
