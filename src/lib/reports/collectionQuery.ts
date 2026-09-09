import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CollectionFilters {
  orgId: string;
  from?: string | null;
  to?: string | null;
  courseId?: string | null;
  batchId?: string | null;
  paymentMode?: string | null;
  createdBy?: string | null;
  status?: string | null; // COMPLETED | CANCELLED
}

const SELECT =
  'id, payment_date, amount, payment_mode, reference_number, status, created_at, students!inner(name, student_code, course_id, batch_id, courses(name), batches(name)), profiles!payments_created_by_fkey(full_name), receipts(receipt_number, status)';

export function buildCollectionQuery(supabase: SupabaseClient, filters: CollectionFilters, opts?: { count?: 'exact' }) {
  let query = supabase
    .from('payments')
    .select(SELECT, opts?.count ? { count: opts.count } : undefined)
    .eq('org_id', filters.orgId);

  query = query.eq('status', filters.status ?? 'COMPLETED');
  if (filters.from) query = query.gte('payment_date', filters.from);
  if (filters.to) query = query.lte('payment_date', filters.to);
  if (filters.courseId) query = query.eq('students.course_id', filters.courseId);
  if (filters.batchId) query = query.eq('students.batch_id', filters.batchId);
  if (filters.paymentMode) query = query.eq('payment_mode', filters.paymentMode);
  if (filters.createdBy) query = query.eq('created_by', filters.createdBy);

  return query;
}
