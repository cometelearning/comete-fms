import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';
const PAGE_SIZE = 25;

/**
 * Practice Copy Check - "teacher will mention student name and date on
 * which it is checked and signed along with teacher name from the
 * drop down." Minimal record: student, date, teacher (the teacher
 * selection itself stands in for "signed by" - there's no separate
 * signature field). Same bespoke-handlers pattern as ptm_records/
 * practice_slips.
 */
export async function GET(request: Request) {
  try {
    const session = await requirePermission('students.read');
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');
    const teacherId = searchParams.get('teacher_id');
    const q = searchParams.get('q')?.trim();
    const studentStatus = searchParams.get('student_status');
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));

    let query = supabase
      .from('practice_copy_checks')
      .select(
        'id, student_id, check_date, teacher_id, remarks, created_at, students!inner(name, student_code, status, classes(name)), teachers(name)',
        { count: 'exact' }
      )
      .eq('org_id', session.orgId);

    if (studentId) query = query.eq('student_id', studentId);
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

    query = query.order('check_date', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ data, count, page, pageSize: PAGE_SIZE });
  } catch (error) {
    return apiError(error);
  }
}

const insertSchema = z.object({
  student_id: z.string().uuid(),
  check_date: z.string().min(1),
  teacher_id: z.string().uuid(),
  remarks: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const session = await requirePermission('students.write');
    const body = insertSchema.parse(await request.json());
    const supabase = createClient();

    const { data, error } = await supabase
      .from('practice_copy_checks')
      .insert({
        org_id: session.orgId,
        student_id: body.student_id,
        check_date: body.check_date,
        teacher_id: body.teacher_id,
        remarks: body.remarks || null,
        created_by: session.userId
      })
      .select()
      .single();
    if (error) throw error;

    await supabase.rpc('write_audit_log', {
      p_action: 'PRACTICE_COPY_CHECK_CREATED',
      p_module: 'practice_copy_checks',
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
