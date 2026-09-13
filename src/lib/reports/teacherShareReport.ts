import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_TEACHER_SHARE_PAYOUT_PERCENT } from '@/lib/settings/teacherShare';

/**
 * Teacher Tuition Share calculation (migration 0023).
 *
 * Per the user's explicit instructions:
 * "Whatever subject share would be defined out of total tuition fee only.
 * It should be by default assumed that the fees collected are first
 * adjusted with Admission Fee, Study Material Kit, Examination Fee and rest
 * will be taken for tuition fees. Only share in tuition fee be given to the
 * teachers. Further whatever sharing % is mentioned only 60% of such shares
 * belongs to teachers, rest belongs to tuition itself."
 *
 * This is read-only against payments/receipts - it never writes to any
 * financial table and never processes a payout. Fee heads only exist at
 * the Fee Structure level (fee_structure_items), not on individual
 * payments, so "Admission/Study Material/Examination Fee first, Tuition
 * gets the remainder" is modelled as a WATERFALL over a student's
 * cumulative collections on one fee account: every fee head other than the
 * one flagged is_tuition sums into a single "non-tuition floor"; cumulative
 * collections up to that floor are non-tuition, and only collections beyond
 * it are tuition. The order of Admission/Study Material/Examination Fee
 * among themselves doesn't change this (their total is a sum either way),
 * so no fee-head ordering is needed - only the single is_tuition flag.
 *
 * A teacher's share for a period is the TUITION portion realised in that
 * period (i.e. the incremental amount by which cumulative collections
 * crossed further past the non-tuition floor during the period) multiplied
 * by their rule's share_percentage, then multiplied by the org-wide payout
 * percent (default 60%) - the remainder is not tracked separately; it was
 * already collected as an ordinary payment and stays with the institute.
 */

export interface TeacherShareReportRow {
  shareId: string;
  teacherId: string;
  teacherName: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  className: string | null;
  sharePercentage: number;
  accountId: string;
  tuitionCollectedInRange: number;
  nominalShareAmount: number;
  teacherPayoutAmount: number;
  instituteRetainedAmount: number;
}

export interface TeacherShareTotal {
  teacherId: string;
  teacherName: string;
  tuitionCollectedInRange: number;
  nominalShareAmount: number;
  teacherPayoutAmount: number;
}

export interface TeacherShareReportResult {
  // false when no fee head has been flagged as the Tuition Fee head yet
  // (Fee Heads master) - nothing can be calculated until then.
  configured: boolean;
  payoutPercent: number;
  rows: TeacherShareReportRow[];
  totalsByTeacher: TeacherShareTotal[];
  grandTotalPayout: number;
}

interface FeeAccountRow {
  id: string;
  student_id: string;
  fee_structure_id: string;
  total_fee: number;
}

export async function fetchTeacherShareReport(
  supabase: SupabaseClient,
  orgId: string,
  filters: { teacherId?: string | null; from: string; to: string }
): Promise<TeacherShareReportResult> {
  const { data: tuitionHead } = await supabase.from('fee_heads').select('id').eq('org_id', orgId).eq('is_tuition', true).maybeSingle();

  const empty = (configured: boolean, payoutPercent: number): TeacherShareReportResult => ({
    configured,
    payoutPercent,
    rows: [],
    totalsByTeacher: [],
    grandTotalPayout: 0
  });

  const { data: settingRow } = await supabase
    .from('settings')
    .select('value')
    .eq('org_id', orgId)
    .eq('key', 'teacher_share_payout_percent')
    .maybeSingle();
  const payoutPercent =
    typeof (settingRow?.value as { percent?: number } | null)?.percent === 'number'
      ? (settingRow!.value as { percent: number }).percent
      : DEFAULT_TEACHER_SHARE_PAYOUT_PERCENT;

  if (!tuitionHead) return empty(false, payoutPercent);
  const tuitionFeeHeadId = tuitionHead.id as string;

  let ruleQuery = supabase
    .from('teacher_student_shares')
    .select(
      'id, teacher_id, student_id, share_percentage, effective_from, effective_to, teachers(name), students(name, student_code, classes(name))'
    )
    .eq('org_id', orgId)
    .eq('status', 'ACTIVE')
    .lte('effective_from', filters.to);
  if (filters.teacherId) ruleQuery = ruleQuery.eq('teacher_id', filters.teacherId);
  const { data: rulesRaw, error: rulesError } = await ruleQuery;
  if (rulesError) throw rulesError;

  const rules = (rulesRaw ?? []).filter((r: any) => !r.effective_to || r.effective_to >= filters.from); // eslint-disable-line @typescript-eslint/no-explicit-any
  if (rules.length === 0) return empty(true, payoutPercent);

  const studentIds = [...new Set(rules.map((r: any) => r.student_id))]; // eslint-disable-line @typescript-eslint/no-explicit-any

  const { data: accounts, error: accountsError } = await supabase
    .from('student_fee_accounts')
    .select('id, student_id, fee_structure_id, total_fee')
    .eq('org_id', orgId)
    .in('student_id', studentIds);
  if (accountsError) throw accountsError;

  const feeStructureIds = [...new Set((accounts ?? []).map((a: FeeAccountRow) => a.fee_structure_id))];
  const accountIds = (accounts ?? []).map((a: FeeAccountRow) => a.id);

  const { data: items, error: itemsError } =
    feeStructureIds.length > 0
      ? await supabase.from('fee_structure_items').select('fee_structure_id, fee_head_id, amount').in('fee_structure_id', feeStructureIds)
      : { data: [] as { fee_structure_id: string; fee_head_id: string; amount: number }[], error: null };
  if (itemsError) throw itemsError;

  const nonTuitionFloorByStructure = new Map<string, number>();
  const hasTuitionItemByStructure = new Set<string>();
  for (const item of items ?? []) {
    if (item.fee_head_id === tuitionFeeHeadId) {
      hasTuitionItemByStructure.add(item.fee_structure_id);
    } else {
      nonTuitionFloorByStructure.set(item.fee_structure_id, (nonTuitionFloorByStructure.get(item.fee_structure_id) ?? 0) + Number(item.amount));
    }
  }

  const { data: payments, error: paymentsError } =
    accountIds.length > 0
      ? await supabase
          .from('payments')
          .select('student_fee_account_id, payment_date, amount')
          .eq('org_id', orgId)
          .eq('status', 'COMPLETED')
          .in('student_fee_account_id', accountIds)
      : { data: [] as { student_fee_account_id: string; payment_date: string; amount: number }[], error: null };
  if (paymentsError) throw paymentsError;

  const paymentsByAccount = new Map<string, { payment_date: string; amount: number }[]>();
  for (const p of payments ?? []) {
    const list = paymentsByAccount.get(p.student_fee_account_id) ?? [];
    list.push({ payment_date: p.payment_date, amount: Number(p.amount) });
    paymentsByAccount.set(p.student_fee_account_id, list);
  }

  function cumulativePaid(accountId: string, predicate: (date: string) => boolean): number {
    const list = paymentsByAccount.get(accountId) ?? [];
    return list.filter((p) => predicate(p.payment_date)).reduce((sum, p) => sum + p.amount, 0);
  }

  const accountsByStudent = new Map<string, FeeAccountRow[]>();
  for (const a of (accounts ?? []) as FeeAccountRow[]) {
    const list = accountsByStudent.get(a.student_id) ?? [];
    list.push(a);
    accountsByStudent.set(a.student_id, list);
  }

  const rows: TeacherShareReportRow[] = [];

  for (const rule of rules as any[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const studentAccounts = accountsByStudent.get(rule.student_id) ?? [];
    for (const account of studentAccounts) {
      if (!hasTuitionItemByStructure.has(account.fee_structure_id)) continue; // this structure has no Tuition Fee component at all

      const nonTuitionFloor = nonTuitionFloorByStructure.get(account.fee_structure_id) ?? 0;
      const tuitionFloor = Math.max(0, Number(account.total_fee) - nonTuitionFloor);

      const rangeStart = rule.effective_from > filters.from ? rule.effective_from : filters.from;
      const rangeEnd = rule.effective_to && rule.effective_to < filters.to ? rule.effective_to : filters.to;
      if (rangeStart > rangeEnd) continue;

      const tuitionRealisedAsOf = (asOfDate: string) => {
        const cumulative = cumulativePaid(account.id, (d) => d <= asOfDate);
        return Math.min(Math.max(0, cumulative - nonTuitionFloor), tuitionFloor);
      };
      const tuitionBefore = (() => {
        const cumulative = cumulativePaid(account.id, (d) => d < rangeStart);
        return Math.min(Math.max(0, cumulative - nonTuitionFloor), tuitionFloor);
      })();
      const tuitionCollectedInRange = Math.max(0, tuitionRealisedAsOf(rangeEnd) - tuitionBefore);
      if (tuitionCollectedInRange <= 0) continue;

      const nominalShareAmount = (tuitionCollectedInRange * Number(rule.share_percentage)) / 100;
      const teacherPayoutAmount = (nominalShareAmount * payoutPercent) / 100;
      const instituteRetainedAmount = nominalShareAmount - teacherPayoutAmount;

      rows.push({
        shareId: rule.id,
        teacherId: rule.teacher_id,
        teacherName: rule.teachers?.name ?? '-',
        studentId: rule.student_id,
        studentName: rule.students?.name ?? '-',
        studentCode: rule.students?.student_code ?? '-',
        className: rule.students?.classes?.name ?? null,
        sharePercentage: Number(rule.share_percentage),
        accountId: account.id,
        tuitionCollectedInRange,
        nominalShareAmount,
        teacherPayoutAmount,
        instituteRetainedAmount
      });
    }
  }

  const totalsMap = new Map<string, TeacherShareTotal>();
  for (const row of rows) {
    const existing = totalsMap.get(row.teacherId) ?? {
      teacherId: row.teacherId,
      teacherName: row.teacherName,
      tuitionCollectedInRange: 0,
      nominalShareAmount: 0,
      teacherPayoutAmount: 0
    };
    existing.tuitionCollectedInRange += row.tuitionCollectedInRange;
    existing.nominalShareAmount += row.nominalShareAmount;
    existing.teacherPayoutAmount += row.teacherPayoutAmount;
    totalsMap.set(row.teacherId, existing);
  }
  const totalsByTeacher = [...totalsMap.values()].sort((a, b) => b.teacherPayoutAmount - a.teacherPayoutAmount);
  const grandTotalPayout = totalsByTeacher.reduce((sum, t) => sum + t.teacherPayoutAmount, 0);

  return { configured: true, payoutPercent, rows, totalsByTeacher, grandTotalPayout };
}
