import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CollectionFilters {
  orgId: string;
  from?: string | null;
  to?: string | null;
  courseId?: string | null;
  classId?: string | null;
  paymentMode?: string | null;
  createdBy?: string | null;
  status?: string | null; // COMPLETED | CANCELLED
}

// Class filters directly on students.class_id (migration 0018) - a
// student's own Class, never derived from their course (a course can be
// tagged to more than one Class, migration 0016).
const SELECT =
  'id, payment_date, amount, payment_mode, reference_number, status, created_at, students!inner(name, student_code, course_id, class_id, courses(name), classes(name)), profiles!payments_created_by_fkey(full_name), receipts(receipt_number, status)';

export function buildCollectionQuery(supabase: SupabaseClient, filters: CollectionFilters, opts?: { count?: 'exact' }) {
  let query = supabase
    .from('payments')
    .select(SELECT, opts?.count ? { count: opts.count } : undefined)
    .eq('org_id', filters.orgId);

  query = query.eq('status', filters.status ?? 'COMPLETED');
  if (filters.from) query = query.gte('payment_date', filters.from);
  if (filters.to) query = query.lte('payment_date', filters.to);
  if (filters.courseId) query = query.eq('students.course_id', filters.courseId);
  if (filters.classId) query = query.eq('students.class_id', filters.classId);
  if (filters.paymentMode) query = query.eq('payment_mode', filters.paymentMode);
  if (filters.createdBy) query = query.eq('created_by', filters.createdBy);

  return query;
}
