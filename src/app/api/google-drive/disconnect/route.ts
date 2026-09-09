import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/session';
import { disconnectDrive } from '@/lib/google-drive/client';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const session = await requirePermission('settings.manage');
    await disconnectDrive(session.orgId);
    return NextResponse.json({ data: { status: 'DISCONNECTED' } });
  } catch (error) {
    return apiError(error);
  }
}
