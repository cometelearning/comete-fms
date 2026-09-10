import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface StudentRecordFilters {
  orgId: string;
  academicYearId?: string | null;
  courseId?: string | null;
  courseIds?: string[] | null; // resolved from a class/standard filter - see classFilter.ts
  status?: string | null;
  q?: string | null;
}

const SELECT =
  'id, student_code, admission_number, name, student_mobile, parent_mobile, status, academic_year_id, course_id, courses(name, class_standard), academic_years(name)';

export function buildStudentRecordQuery(supabase: SupabaseClient, filters: StudentRecordFilters, opts?: { count?: 'exact' }) {
  let query = supabase.from('students').select(SELECT, opts?.count ? { count: opts.count } : undefined).eq('org_id', filters.orgId);

  if (filters.academicYearId) query = query.eq('academic_year_id', filters.academicYearId);
  if (filters.courseId) query = query.eq('course_id', filters.courseId);
  if (filters.courseIds) {
    // Empty array = a class filter matched no courses at all, so the result
    // set must be empty too - filter on an id that can never match.
    query = query.in('course_id', filters.courseIds.length > 0 ? filters.courseIds : ['00000000-0000-0000-0000-000000000000']);
  }
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.q) {
    const like = `%${filters.q}%`;
    query = query.or(`name.ilike.${like},student_code.ilike.${like},admission_number.ilike.${like}`);
  }

  return query;
}

export interface StudentFeeTotals {
  totalFee: number;
  paidTotal: number;
  outstandingTotal: number;
}

/**
 * Fee summary is per fee-account (a student can have more than one, e.g.
 * across academic years), but the Student Record report is one row per
 * student - so this sums every account onto its student. Only called for
 * the exact student ids already on the page/export, never the whole table.
 */
export async function fetchStudentFeeTotals(
  supabase: SupabaseClient,
  orgId: string,
  studentIds: string[]
): Promise<Map<string, StudentFeeTotals>> {
  const totals = new Map<string, StudentFeeTotals>();
  if (studentIds.length === 0) return totals;

  const { data, error } = await supabase
    .from('student_fee_summary')
    .select('student_id, total_fee, paid_total, outstanding_total')
    .eq('org_id', orgId)
    .in('student_id', studentIds);
  if (error) throw error;

  for (const row of data ?? []) {
    const existing = totals.get(row.student_id) ?? { totalFee: 0, paidTotal: 0, outstandingTotal: 0 };
    existing.totalFee += Number(row.total_fee) || 0;
    existing.paidTotal += Number(row.paid_total) || 0;
    existing.outstandingTotal += Number(row.outstanding_total) || 0;
    totals.set(row.student_id, existing);
  }

  return totals;
}
