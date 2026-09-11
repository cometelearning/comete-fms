import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission, ForbiddenError } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

// Activate/Deactivate a student, migration 0019 - deliberately separated
// from the general PATCH /api/students/[id] (edit) route and restricted to
// Super Admin only, per explicit user request ("These rights should only be
// with super admin"), even though Admin/Accountant already hold
// students.write for everything else on the student form. A database
// trigger (enforce_student_status_change, migration 0019) backs this up
// even against a raw table update that bypasses this route entirely.
const statusSchema = z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) });

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('students.write');
    if (session.role.key !== 'super_admin') {
      throw new ForbiddenError('Only Super Admin can activate or deactivate a student.');
    }
    const body = statusSchema.parse(await request.json());
    const supabase = createClient();

    const { data: previous, error: previousError } = await supabase
      .from('students')
      .select('*')
      .eq('id', params.id)
      .eq('org_id', session.orgId)
      .single();
    if (previousError) throw previousError;

    const { data, error } = await supabase
      .from('students')
      .update({ status: body.status })
      .eq('id', params.id)
      .eq('org_id', session.orgId)
      .select()
      .single();
    if (error) throw error;

    await supabase.rpc('write_audit_log', {
      p_action: body.status === 'ACTIVE' ? 'STUDENT_ACTIVATED' : 'STUDENT_DEACTIVATED',
      p_module: 'students',
      p_record_id: params.id,
      p_previous_value: previous,
      p_new_value: data,
      p_reason: null
    });

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
