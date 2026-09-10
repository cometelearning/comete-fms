import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

/**
 * Returns one fee account's raw fee-head breakdown and installment
 * schedule (not the computed installment_status view) so the "Edit Fee"
 * dialog can be pre-filled with exactly what was entered.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('student_fees.read');
    const supabase = createClient();

    const { data: account, error: accountError } = await supabase
      .from('student_fee_accounts')
      .select('id, student_id, fee_structure_id, total_fee')
      .eq('id', params.id)
      .eq('org_id', session.orgId)
      .single();
    if (accountError) throw accountError;

    const [{ data: items, error: itemsError }, { data: installments, error: installmentsError }] = await Promise.all([
      supabase.from('fee_structure_items').select('fee_head_id, amount').eq('fee_structure_id', account.fee_structure_id),
      supabase
        .from('fee_structure_installments')
        .select('seq_no, label, amount, due_date')
        .eq('fee_structure_id', account.fee_structure_id)
        .order('seq_no', { ascending: true })
    ]);
    if (itemsError) throw itemsError;
    if (installmentsError) throw installmentsError;

    return NextResponse.json({ data: { ...account, items: items ?? [], installments: installments ?? [] } });
  } catch (error) {
    return apiError(error);
  }
}

const itemSchema = z.object({ fee_head_id: z.string().uuid(), amount: z.number().positive() });
const installmentSchema = z.object({
  seq_no: z.number().int().positive(),
  label: z.string().min(1),
  amount: z.number().positive(),
  due_date: z.string()
});

const updateSchema = z.object({
  items: z.array(itemSchema).min(1),
  installments: z.array(installmentSchema).min(1)
});

/**
 * Fixes a fee that was entered by mistake - only ever before any money has
 * moved against it (update_student_fee() blocks this once a payment or
 * discount exists on the account, per spec #25).
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    await requirePermission('student_fees.write');
    const body = updateSchema.parse(await request.json());
    const supabase = createClient();

    const { data, error } = await supabase.rpc('update_student_fee', {
      p_student_fee_account_id: params.id,
      p_items: body.items,
      p_installments: body.installments
    });
    if (error) throw error;

    return NextResponse.json({ data: { student_fee_account_id: data } });
  } catch (error) {
    return apiError(error);
  }
}
