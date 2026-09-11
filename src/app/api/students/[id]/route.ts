import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('students.read');
    const supabase = createClient();
    const { data, error } = await supabase.from('students').select('*').eq('id', params.id).eq('org_id', session.orgId).single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}

// Every field on the Edit Student form is mandatory, same as creating one
// (see src/app/api/students/route.ts), except student_mobile / student_email
// / parent_email / last_year_percentage / remarks, which stay optional.
// admission_number is NOT in this schema at all - like student_code, it is
// system-generated once at creation and is never accepted from the client,
// so it can never be changed via this endpoint (the `update` object below
// only ever contains keys this schema parsed). The Edit Student form always
// submits the full form, so this mirrors the insert schema rather than
// being a true partial update; `status` is the one exception (not a field
// on the form today).
const updateSchema = z.object({
  name: z.string().min(2),
  guardian_name: z.string().min(1),
  date_of_birth: z.string().min(1),
  student_mobile: z.string().optional().nullable(),
  parent_mobile: z.string().min(1),
  student_email: z.string().email().optional().nullable().or(z.literal('')),
  parent_email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().min(1),
  course_id: z.string().uuid(),
  batch_id: z.string().uuid(),
  academic_year_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  board_id: z.string().uuid(),
  school_name: z.string().min(1),
  last_year_percentage: z.string().optional().nullable(),
  admission_date: z.string().min(1),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  remarks: z.string().optional().nullable()
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('students.write');
    const body = updateSchema.parse(await request.json());
    // student_mobile / student_email / parent_email / last_year_percentage /
    // remarks are optional: normalize '' (an untouched field on the form) to
    // null before writing.
    const update: Record<string, unknown> = {
      ...body,
      student_mobile: body.student_mobile || null,
      student_email: body.student_email || null,
      parent_email: body.parent_email || null,
      last_year_percentage: body.last_year_percentage || null,
      remarks: body.remarks || null
    };
    const supabase = createClient();

    const { data: previous } = await supabase.from('students').select('*').eq('id', params.id).eq('org_id', session.orgId).single();

    const { data, error } = await supabase
      .from('students')
      .update(update)
      .eq('id', params.id)
      .eq('org_id', session.orgId)
      .select()
      .single();
    if (error) throw error;

    await supabase.rpc('write_audit_log', {
      p_action: 'STUDENT_UPDATED',
      p_module: 'students',
      p_record_id: params.id,
      p_previous_value: previous ?? null,
      p_new_value: data,
      p_reason: null
    });

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
