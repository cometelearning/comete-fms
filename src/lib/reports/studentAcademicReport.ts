import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * "Make sure all the academics are mapped to the students and a report be
 * given as students academic report" - pulls together every academics
 * module (PTM, Practice Slips, Student Performance/marks, Practice Copy
 * Check) for one student into a single structure, shared by the on-screen
 * report (/students/[id]/academic-report) and its PDF export so the two
 * never drift apart.
 */
export async function fetchStudentAcademicReportData(supabase: SupabaseClient, orgId: string, studentId: string) {
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, name, student_code, guardian_name, status, course_id, class_id, academic_year_id, courses(name), classes(name), academic_years(name)')
    .eq('id', studentId)
    .eq('org_id', orgId)
    .single();
  if (studentError) throw studentError;

  const [{ data: ptmRecords }, { data: practiceSlips }, { data: performanceRecords }, { data: copyChecks }] = await Promise.all([
    supabase
      .from('ptm_records')
      .select('ptm_date, attended, parent_remarks, counsellor_remarks')
      .eq('org_id', orgId)
      .eq('student_id', studentId)
      .order('ptm_date', { ascending: false }),
    supabase
      .from('practice_slips')
      .select('slip_date, topic, level, status, subjects(name)')
      .eq('org_id', orgId)
      .eq('student_id', studentId)
      .order('slip_date', { ascending: false }),
    supabase
      .from('student_performance_records')
      .select('exam_date, topic, total_marks, marks_obtained, subjects(name), teachers(name)')
      .eq('org_id', orgId)
      .eq('student_id', studentId)
      .order('exam_date', { ascending: false }),
    supabase
      .from('practice_copy_checks')
      .select('check_date, remarks, teachers(name)')
      .eq('org_id', orgId)
      .eq('student_id', studentId)
      .order('check_date', { ascending: false })
  ]);

  return {
    student,
    ptmRecords: ptmRecords ?? [],
    practiceSlips: practiceSlips ?? [],
    performanceRecords: performanceRecords ?? [],
    copyChecks: copyChecks ?? []
  };
}
