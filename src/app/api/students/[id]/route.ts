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

const updateSchema = z.object({
  admission_number: z.string().optional().nullable(),
  name: z.string().min(2).optional(),
  guardian_name: z.string().optional().nullable(),
  student_mobile: z.string().optional().nullable(),
  parent_mobile: z.string().optional().nullable(),
  student_email: z.string().email().optional().nullable().or(z.literal('')),
  parent_email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  course_id: z.string().uuid().optional().nullable(),
  batch_id: z.string().uuid().optional().nullable(),
  academic_year_id: z.string().uuid().optional().nullable(),
  admission_date: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  remarks: z.string().optional().nullable()
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('students.write');
    const body = updateSchema.parse(await request.json());
    const supabase = createClient();

    const { data: previous } = await supabase.from('students').select('*').eq('id', params.id).eq('org_id', session.orgId).single();

    const { data, error } = await supabase
      .from('students')
      .update(body)
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
