import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

/**
 * Returns only the SAFE fields from google_drive_accounts (status, email,
 * last error, timestamps). Refresh/access tokens never leave the server -
 * this route uses the admin client precisely because the table has no
 * SELECT policy for `authenticated` at all (see 0003).
 */
export async function GET() {
  try {
    const session = await requirePermission('settings.manage');
    const admin = createAdminClient();
    const { data } = await admin
      .from('google_drive_accounts')
      .select('status, connected_email, connected_at, last_error, root_folder_id')
      .eq('org_id', session.orgId)
      .single();

    return NextResponse.json({
      data: data ?? { status: 'DISCONNECTED', connected_email: null, connected_at: null, last_error: null },
      configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    });
  } catch (error) {
    return apiError(error);
  }
}
