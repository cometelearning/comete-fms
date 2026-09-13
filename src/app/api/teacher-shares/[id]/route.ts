import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

const updateSchema = z
  .object({
    share_percentage: z.number().positive().max(100).optional(),
    effective_from: z.string().min(1).optional(),
    effective_to: z.string().min(1).optional().nullable(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional()
  })
  .refine((v) => !v.effective_to || !v.effective_from || v.effective_to >= v.effective_from, {
    message: 'Effective To cannot be before Effective From.',
    path: ['effective_to']
  });

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('settings.manage');
    const body = updateSchema.parse(await request.json());
    const supabase = createClient();

    const { data: previous } = await supabase
      .from('teacher_student_shares')
      .select('*')
      .eq('id', params.id)
      .eq('org_id', session.orgId)
      .single();

    const { data, error } = await supabase
      .from('teacher_student_shares')
      .update(body)
      .eq('id', params.id)
      .eq('org_id', session.orgId)
      .select()
      .single();
    if (error) throw error;

    await supabase.rpc('write_audit_log', {
      p_action: 'TEACHER_SHARE_UPDATED',
      p_module: 'teacher_student_shares',
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
