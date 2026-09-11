import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

// Cross-field (marks_obtained <= total_marks) validation on a partial edit
// is enforced by the DB check constraint (marks_obtained_within_total,
// migration 0021) rather than re-derived here, since either field can be
// edited independently - a Postgres violation is mapped to a friendly
// message in src/lib/api/handler.ts.
const updateSchema = z.object({
  exam_date: z.string().min(1).optional(),
  subject_id: z.string().uuid().optional(),
  topic: z.string().min(1).optional(),
  total_marks: z.number().positive().optional(),
  marks_obtained: z.number().min(0).optional(),
  teacher_id: z.string().uuid().optional()
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('students.write');
    const body = updateSchema.parse(await request.json());
    const supabase = createClient();

    const { data: previous } = await supabase
      .from('student_performance_records')
      .select('*')
      .eq('id', params.id)
      .eq('org_id', session.orgId)
      .single();

    const { data, error } = await supabase
      .from('student_performance_records')
      .update(body)
      .eq('id', params.id)
      .eq('org_id', session.orgId)
      .select()
      .single();
    if (error) throw error;

    await supabase.rpc('write_audit_log', {
      p_action: 'STUDENT_PERFORMANCE_RECORD_UPDATED',
      p_module: 'student_performance_records',
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
