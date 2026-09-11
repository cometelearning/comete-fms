import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface OutstandingFilters {
  orgId: string;
  academicYearId?: string | null;
  courseId?: string | null;
  classId?: string | null;
  q?: string | null;
  overdueOnly?: boolean;
  minAmount?: number | null;
  studentStatus?: string | null;
}

// Class filters directly on students.class_id (migration 0018) - a
// student's own Class, never derived from their course (a course can be
// tagged to more than one Class, migration 0016).
const SELECT =
  '*, fee_structures(name), academic_years(name), students!inner(name, student_code, student_mobile, parent_mobile, course_id, class_id, status, courses(name), classes(name))';

export function buildOutstandingQuery(supabase: SupabaseClient, filters: OutstandingFilters, opts?: { count?: 'exact' }) {
  let query = supabase
    .from('student_fee_summary')
    .select(SELECT, opts?.count ? { count: opts.count } : undefined)
    .eq('org_id', filters.orgId)
    .gt('outstanding_total', 0);

  if (filters.academicYearId) query = query.eq('academic_year_id', filters.academicYearId);
  if (filters.courseId) query = query.eq('students.course_id', filters.courseId);
  if (filters.classId) query = query.eq('students.class_id', filters.classId);
  // Default-hide inactive students unless a filter specifically asks for
  // them (explicit user request) - see studentRecordQuery.ts for the same
  // pattern.
  if (filters.studentStatus !== 'ALL') {
    query = query.eq('students.status', filters.studentStatus || 'ACTIVE');
  }
  if (filters.overdueOnly) query = query.gt('overdue_amount', 0);
  if (filters.minAmount) query = query.gte('outstanding_total', filters.minAmount);
  if (filters.q) {
    query = query.or(`name.ilike.%${filters.q}%,student_code.ilike.%${filters.q}%`, { foreignTable: 'students' });
  }

  return query;
}
