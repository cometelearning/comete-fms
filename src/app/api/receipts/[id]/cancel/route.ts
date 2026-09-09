import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

const schema = z.object({ reason: z.string().min(3, 'Please provide a reason of at least 3 characters.') });

/**
 * Cancels a receipt. cancel_receipt() (0005) flips status to CANCELLED,
 * reverses the payment's financial effect, and writes the audit entry - all
 * as one transaction. The receipt row and its number are never deleted or
 * reused (spec #24).
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await requirePermission('receipts.cancel');
    const body = schema.parse(await request.json());
    const supabase = createClient();

    const { data, error } = await supabase.rpc('cancel_receipt', { p_receipt_id: params.id, p_reason: body.reason });
    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
