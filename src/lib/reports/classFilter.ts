import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * DEPRECATED as of migration 0018 - no longer called anywhere in the app.
 * Safe to delete this file.
 *
 * This existed because Collection/Outstanding/Student Record's class filter
 * used to resolve a class to the set of course ids tagged to it (via
 * course_classes, migration 0016), then filter `students.course_id in
 * (...)`. That was already an approximation: it matched every student on a
 * course tagged to the filtered class, even a student who was actually in a
 * *different* class the same course happens to also be tagged to.
 *
 * Migration 0018 fixed the root cause by giving each student their own
 * `class_id` (a student's Class was previously only inferable from their
 * course, which broke once a course could be tagged to more than one
 * class). Every class filter - Collection Report, Outstanding, Student
 * Record report, and the Dashboard - now filters `students.class_id`
 * directly, correctly and more simply, with no join through course_classes
 * needed at all. See `collectionQuery.ts` / `outstandingQuery.ts` /
 * `studentRecordQuery.ts` (a plain `classId` filter) and `dashboard_summary()`
 * (migration 0018, `p_class_id` now matches `s.class_id` directly).
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
