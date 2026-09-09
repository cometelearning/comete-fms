import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';
import { getReceiptDetail } from '@/lib/receipts/getReceiptDetail';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('receipts.read');
    const supabase = createClient();
    const detail = await getReceiptDetail(supabase, session.orgId, params.id);
    return NextResponse.json({ data: detail });
  } catch (error) {
    return apiError(error);
  }
}
