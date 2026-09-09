import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Report/outstanding filters accept a `class` (courses.class_standard) query
 * param, but the underlying queries filter on payments/student_fee_summary
 * joined to `students`, which only carries `course_id` - not class_standard
 * directly. PostgREST can't reliably filter two embedded joins deep
 * (payments -> students -> courses.class_standard), so instead we resolve
 * the class name to the set of matching course ids here, then the caller
 * filters `students.course_id in (...)`.
 *
 * Returns null when no class filter was requested (meaning: don't restrict
 * by course at all), or an array of course ids (possibly empty, meaning: no
 * course matches this class, so the result set should be empty) otherwise.
 */
export async function resolveClassToCourseIds(
  supabase: SupabaseClient,
  orgId: string,
  classStandard: string | null | undefined
): Promise<string[] | null> {
  if (!classStandard) return null;
  const { data } = await supabase.from('courses').select('id').eq('org_id', orgId).eq('class_standard', classStandard);
  return (data ?? []).map((c) => c.id);
}
