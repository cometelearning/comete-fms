import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Report/outstanding filters accept a `class_id` query param, but the
 * underlying queries filter on payments/student_fee_summary joined to
 * `students`, which only carries `course_id` - not class directly.
 * PostgREST can't reliably filter two embedded joins deep (payments ->
 * students -> courses -> course_classes), so instead we resolve the class
 * to the set of matching course ids here (via the course_classes join
 * table, migration 0016 - a course can now be tagged to more than one
 * class), then the caller filters `students.course_id in (...)`.
 *
 * Returns null when no class filter was requested (meaning: don't restrict
 * by course at all), or an array of course ids (possibly empty, meaning: no
 * course is tagged to this class, so the result set should be empty)
 * otherwise.
 *
 * Note: the Dashboard's class filter does NOT go through this helper - it
 * filters via the separate dashboard_summary() RPC (migration 0009), which
 * still matches on courses.class_standard text and was not rewritten to use
 * course_classes. That means the Dashboard's class filter under-matches any
 * course tagged to more than one class - a known, flagged limitation, not a
 * bug in this helper.
 */
export async function resolveClassToCourseIds(
  supabase: SupabaseClient,
  orgId: string,
  classId: string | null | undefined
): Promise<string[] | null> {
  if (!classId) return null;
  const { data } = await supabase.from('course_classes').select('course_id').eq('org_id', orgId).eq('class_id', classId);
  return (data ?? []).map((c) => c.course_id);
}
