import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

const PAGE_SIZE = 25;

/**
 * Global student search: name / Student ID / admission number / student
 * mobile / parent mobile / email, plus course/batch/year/status filters and
 * pagination so the browser never has to load the whole student table.
 */
export async function GET(request: Request) {
  try {
    const session = await requirePermission('students.read');
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const courseId = searchParams.get('course_id');
    const batchId = searchParams.get('batch_id');
    const academicYearId = searchParams.get('academic_year_id');
    const status = searchParams.get('status');
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));

    let query = supabase
      .from('students')
      .select('id, student_code, admission_number, name, guardian_name, student_mobile, parent_mobile, student_email, course_id, batch_id, academic_year_id, status, admission_date', {
        count: 'exact'
      })
      .eq('org_id', session.orgId);

    if (q) {
      const like = `%${q}%`;
      query = query.or(
        `name.ilike.${like},student_code.ilike.${like},admission_number.ilike.${like},student_mobile.ilike.${like},parent_mobile.ilike.${like},student_email.ilike.${like},parent_email.ilike.${like}`
      );
    }
    if (courseId) query = query.eq('course_id', courseId);
    if (batchId) query = query.eq('batch_id', batchId);
    if (academicYearId) query = query.eq('academic_year_id', academicYearId);
    if (status) query = query.eq('status', status);

    query = query.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ data, count, page, pageSize: PAGE_SIZE });
  } catch (error) {
    return apiError(error);
  }
}

// Every field on the Add Student form is mandatory (office data-entry
// policy) except the fee section (handled separately by /api/student-fees),
// student_mobile / student_email / parent_email (not every student has
// their own phone or email yet, and some parents don't have email -
// parent_mobile stays mandatory since there must always be a way to reach a
// guardian), last_year_percentage (some admissions are new students with no
// prior year result) and remarks. admission_number is NOT accepted here at
// all - like student_code, it is system-generated server-side (see
// generate_admission_number, migration 0015) and is never entered or edited
// through the form. The remaining selects are HTML `required` on the form,
// so the browser won't submit them blank in normal use - this schema
// re-checks the same rule server-side.
const insertSchema = z.object({
  name: z.string().min(2),
  guardian_name: z.string().min(1),
  date_of_birth: z.string().min(1),
  student_mobile: z.string().optional(),
  parent_mobile: z.string().min(1),
  student_email: z.string().email().optional().or(z.literal('')),
  parent_email: z.string().email().optional().or(z.literal('')),
  address: z.string().min(1),
  course_id: z.string().uuid(),
  batch_id: z.string().uuid(),
  academic_year_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  board_id: z.string().uuid(),
  school_name: z.string().min(1),
  last_year_percentage: z.string().optional(),
  admission_date: z.string().min(1),
  remarks: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const session = await requirePermission('students.write');
    const body = insertSchema.parse(await request.json());
    const supabase = createClient();

    const [{ data: studentCode, error: codeError }, { data: admissionNumber, error: admissionError }] = await Promise.all([
      supabase.rpc('generate_student_code', { p_org_id: session.orgId }),
      supabase.rpc('generate_admission_number', { p_org_id: session.orgId })
    ]);
    if (codeError) throw codeError;
    if (admissionError) throw admissionError;

    const { data, error } = await supabase
      .from('students')
      .insert({
        org_id: session.orgId,
        student_code: studentCode,
        admission_number: admissionNumber,
        name: body.name,
        guardian_name: body.guardian_name,
        date_of_birth: body.date_of_birth,
        student_mobile: body.student_mobile || null,
        parent_mobile: body.parent_mobile,
        student_email: body.student_email || null,
        parent_email: body.parent_email || null,
        address: body.address,
        course_id: body.course_id,
        batch_id: body.batch_id,
        academic_year_id: body.academic_year_id,
        branch_id: body.branch_id,
        board_id: body.board_id,
        school_name: body.school_name,
        last_year_percentage: body.last_year_percentage || null,
        admission_date: body.admission_date,
        remarks: body.remarks || null,
        created_by: session.userId
      })
      .select()
      .single();
    if (error) throw error;

    await supabase.rpc('write_audit_log', {
      p_action: 'STUDENT_CREATED',
      p_module: 'students',
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
