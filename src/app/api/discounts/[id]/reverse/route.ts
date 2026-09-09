import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';
const schema = z.object({ reason: z.string().min(3) });

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await requirePermission('discounts.grant');
    const body = schema.parse(await request.json());
    const supabase = createClient();
    const { data, error } = await supabase.rpc('reverse_discount', { p_discount_id: params.id, p_reason: body.reason });
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
