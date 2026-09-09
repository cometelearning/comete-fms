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

const insertSchema = z.object({
  admission_number: z.string().optional(),
  name: z.string().min(2),
  guardian_name: z.string().optional(),
  student_mobile: z.string().optional(),
  parent_mobile: z.string().optional(),
  student_email: z.string().email().optional().or(z.literal('')),
  parent_email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  course_id: z.string().uuid().optional().nullable(),
  batch_id: z.string().uuid().optional().nullable(),
  academic_year_id: z.string().uuid().optional().nullable(),
  admission_date: z.string().optional(),
  remarks: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const session = await requirePermission('students.write');
    const body = insertSchema.parse(await request.json());
    const supabase = createClient();

    const { data: studentCode, error: codeError } = await supabase.rpc('generate_student_code', { p_org_id: session.orgId });
    if (codeError) throw codeError;

    const { data, error } = await supabase
      .from('students')
      .insert({
        org_id: session.orgId,
        student_code: studentCode,
        admission_number: body.admission_number || null,
        name: body.name,
        guardian_name: body.guardian_name || null,
        student_mobile: body.student_mobile || null,
        parent_mobile: body.parent_mobile || null,
        student_email: body.student_email || null,
        parent_email: body.parent_email || null,
        address: body.address || null,
        course_id: body.course_id || null,
        batch_id: body.batch_id || null,
        academic_year_id: body.academic_year_id || null,
        admission_date: body.admission_date || new Date().toISOString().slice(0, 10),
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
