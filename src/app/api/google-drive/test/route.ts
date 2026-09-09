import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/session';
import { testDriveConnection } from '@/lib/google-drive/client';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const session = await requirePermission('settings.manage');
    const result = await testDriveConnection(session.orgId);
    return NextResponse.json({ data: result });
  } catch (error) {
    return apiError(error);
  }
}
