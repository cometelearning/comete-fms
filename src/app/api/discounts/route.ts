import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

const schema = z.object({
  student_fee_account_id: z.string().uuid(),
  installment_id: z.string().uuid().nullable(),
  discount_type: z.enum(['FIXED', 'PERCENTAGE']),
  value: z.number().positive(),
  reason: z.string().min(3)
});

/** Grants a discount/concession/waiver. grant_discount() (0005) resolves the rupee amount, validates it, and audit-logs it atomically. */
export async function POST(request: Request) {
  try {
    await requirePermission('discounts.grant');
    const body = schema.parse(await request.json());
    const supabase = createClient();

    const { data, error } = await supabase.rpc('grant_discount', {
      p_student_fee_account_id: body.student_fee_account_id,
      p_installment_id: body.installment_id,
      p_discount_type: body.discount_type,
      p_value: body.value,
      p_reason: body.reason
    });
    if (error) throw error;

    return NextResponse.json({ data: { id: data } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
