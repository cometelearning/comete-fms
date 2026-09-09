import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface OutstandingFilters {
  orgId: string;
  academicYearId?: string | null;
  courseId?: string | null;
  courseIds?: string[] | null;
  q?: string | null;
  overdueOnly?: boolean;
  minAmount?: number | null;
}

const SELECT =
  '*, fee_structures(name), academic_years(name), students!inner(name, student_code, student_mobile, parent_mobile, course_id, courses(name, class_standard))';

export function buildOutstandingQuery(supabase: SupabaseClient, filters: OutstandingFilters, opts?: { count?: 'exact' }) {
  let query = supabase
    .from('student_fee_summary')
    .select(SELECT, opts?.count ? { count: opts.count } : undefined)
    .eq('org_id', filters.orgId)
    .gt('outstanding_total', 0);

  if (filters.academicYearId) query = query.eq('academic_year_id', filters.academicYearId);
  if (filters.courseId) query = query.eq('students.course_id', filters.courseId);
  if (filters.courseIds) {
    // Empty array = a class filter matched no courses at all, so the result
    // set must be empty too - filter on an id that can never match.
    query = query.in('students.course_id', filters.courseIds.length > 0 ? filters.courseIds : ['00000000-0000-0000-0000-000000000000']);
  }
  if (filters.overdueOnly) query = query.gt('overdue_amount', 0);
  if (filters.minAmount) query = query.gte('outstanding_total', filters.minAmount);
  if (filters.q) {
    query = query.or(`name.ilike.%${filters.q}%,student_code.ilike.%${filters.q}%`, { foreignTable: 'students' });
  }

  return query;
}
