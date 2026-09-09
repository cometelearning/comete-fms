import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Pulls together everything a receipt needs to be displayed or rendered to
 * PDF: the receipt + payment, the student (with course/batch/year names),
 * the fee account totals (for previous/current outstanding), and the
 * installment label. Shared by the JSON detail route and the PDF route so
 * they can never drift apart.
 */
export async function getReceiptDetail(supabase: SupabaseClient, orgId: string, receiptId: string) {
  const { data: receipt, error: receiptError } = await supabase
    .from('receipts')
    .select('*, academic_years(name)')
    .eq('id', receiptId)
    .eq('org_id', orgId)
    .single();
  if (receiptError) throw receiptError;

  const { data: payment, error: paymentError } = await supabase.from('payments').select('*').eq('id', receipt.payment_id).single();
  if (paymentError) throw paymentError;

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('*, courses(name), batches(name)')
    .eq('id', payment.student_id)
    .single();
  if (studentError) throw studentError;

  const { data: allocations } = await supabase
    .from('payment_allocations')
    .select('amount, installments(label)')
    .eq('payment_id', payment.id);

  const { data: creator } = await supabase.from('profiles').select('full_name').eq('id', receipt.created_by).single();

  const installmentLabel = (allocations ?? [])
    .map((a: any) => a.installments?.label) // eslint-disable-line @typescript-eslint/no-explicit-any
    .filter(Boolean)
    .join(', ');

  // Outstanding on the fee account AFTER this payment, computed live.
  const { data: summary } = await supabase
    .from('student_fee_summary')
    .select('outstanding_total')
    .eq('student_fee_account_id', payment.student_fee_account_id)
    .single();

  const currentOutstanding = summary?.outstanding_total ?? 0;
  // Previous outstanding = current + this payment's amount (only valid while ACTIVE;
  // if cancelled, the DB no longer counts this payment so we still show what it WAS at issue time).
  const previousOutstanding = receipt.status === 'ACTIVE' ? Number(currentOutstanding) + Number(payment.amount) : Number(currentOutstanding);

  return {
    receipt,
    payment,
    student,
    installmentLabel: installmentLabel || null,
    previousOutstanding,
    currentOutstanding,
    authorizedBy: creator?.full_name ?? 'System'
  };
}
