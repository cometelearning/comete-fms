import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';
const PAGE_SIZE = 25;

/**
 * Student Performance Report (exam marks) - "exam date, subject, topic,
 * total marks and marks obtained, teacher name be filled and saved at any
 * particular date, there should be option to add more rows as and when
 * needed" - one record per exam/subject entry, so "add more rows" is simply
 * adding another record at any time (same pattern as ptm_records/
 * practice_slips, not a single multi-row form).
 */
export async function GET(request: Request) {
  try {
    const session = await requirePermission('students.read');
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');
    const subjectId = searchParams.get('subject_id');
    const teacherId = searchParams.get('teacher_id');
    const q = searchParams.get('q')?.trim();
    const studentStatus = searchParams.get('student_status');
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));

    let query = supabase
      .from('student_performance_records')
      .select(
        'id, student_id, exam_date, subject_id, topic, total_marks, marks_obtained, teacher_id, created_at, students!inner(name, student_code, status, classes(name)), subjects(name), teachers(name)',
        { count: 'exact' }
      )
      .eq('org_id', session.orgId);

    if (studentId) query = query.eq('student_id', studentId);
    if (subjectId) query = query.eq('subject_id', subjectId);
    if (teacherId) query = query.eq('teacher_id', teacherId);
    // Default-hide inactive students unless a filter specifically asks for
    // them, same pattern as every other list/report since the Foundations
    // round - skipped when a specific student_id is requested.
    if (!studentId && studentStatus !== 'ALL') {
      query = query.eq('students.status', studentStatus || 'ACTIVE');
    }
    if (q) {
      const { data: matchingStudents } = await supabase
        .from('students')
        .select('id')
        .eq('org_id', session.orgId)
        .or(`name.ilike.%${q}%,student_code.ilike.%${q}%`);
      const ids = (matchingStudents ?? []).map((s) => s.id);
      query = query.in('student_id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);
    }

    query = query.order('exam_date', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ data, count, page, pageSize: PAGE_SIZE });
  } catch (error) {
    return apiError(error);
  }
}

const insertSchema = z
  .object({
    student_id: z.string().uuid(),
    exam_date: z.string().min(1),
    subject_id: z.string().uuid(),
    topic: z.string().min(1),
    total_marks: z.number().positive(),
    marks_obtained: z.number().min(0),
    teacher_id: z.string().uuid()
  })
  .refine((v) => v.marks_obtained <= v.total_marks, {
    message: 'Marks obtained cannot exceed total marks.',
    path: ['marks_obtained']
  });

export async function POST(request: Request) {
  try {
    const session = await requirePermission('students.write');
    const body = insertSchema.parse(await request.json());
    const supabase = createClient();

    const { data, error } = await supabase
      .from('student_performance_records')
      .insert({
        org_id: session.orgId,
        student_id: body.student_id,
        exam_date: body.exam_date,
        subject_id: body.subject_id,
        topic: body.topic,
        total_marks: body.total_marks,
        marks_obtained: body.marks_obtained,
        teacher_id: body.teacher_id,
        created_by: session.userId
      })
      .select()
      .single();
    if (error) throw error;

    await supabase.rpc('write_audit_log', {
      p_action: 'STUDENT_PERFORMANCE_RECORD_CREATED',
      p_module: 'student_performance_records',
      p_record_id: data.id,
      p_previous_value: null,
      p_new_value: data,
      p_reason: null
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
