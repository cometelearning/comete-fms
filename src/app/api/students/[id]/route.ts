import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission, ForbiddenError } from '@/lib/auth/session';
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
// / parent_email / last_year_percentage / landmark / remarks, which stay
// optional. admission_number is NOT in this schema at all - like
// student_code, it is system-generated once at creation and is never
// accepted from the client, so it can never be changed via this endpoint
// (the `update` object below only ever contains keys this schema parsed).
// Address is five structured fields (migration 0017) instead of one
// free-text box; the old `address` column is simply never written to from
// here. The Edit Student form always submits the full form, so this mirrors
// the insert schema rather than being a true partial update.
//
// `status` is deliberately NOT in this schema (migration 0019) - activating/
// deactivating a student is now a separate, Super-Admin-only action via
// PATCH /api/students/[id]/status, per explicit user request that this
// right stay narrower than the general students.write permission
// Admin/Accountant already hold for everything else on this form. A
// database trigger (enforce_student_status_change) backs this up even
// against a raw table update that bypasses this route entirely.
//
// class_id IS part of this schema (migration 0018) for the same reason it's
// in the insert schema - see the comment there. It's mandatory here too,
// same as course_id/academic_year_id/etc.
const updateSchema = z.object({
  name: z.string().min(2),
  guardian_name: z.string().min(1),
  date_of_birth: z.string().min(1),
  student_mobile: z.string().optional().nullable(),
  parent_mobile: z.string().min(1),
  student_email: z.string().email().optional().nullable().or(z.literal('')),
  parent_email: z.string().email().optional().nullable().or(z.literal('')),
  plot_flat_no: z.string().min(1),
  area: z.string().min(1),
  landmark: z.string().optional().nullable(),
  pincode: z.string().regex(/^\d{6}$/, 'PIN code must be 6 digits'),
  district: z.string().min(1),
  class_id: z.string().uuid(),
  course_id: z.string().uuid(),
  batch_id: z.string().uuid(),
  academic_year_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  board_id: z.string().uuid(),
  school_name: z.string().min(1),
  last_year_percentage: z.string().optional().nullable(),
  admission_date: z.string().min(1),
  remarks: z.string().optional().nullable()
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('students.write');
    const body = updateSchema.parse(await request.json());
    // student_mobile / student_email / parent_email / last_year_percentage /
    // landmark / remarks are optional: normalize '' (an untouched field on
    // the form) to null before writing.
    const update: Record<string, unknown> = {
      ...body,
      student_mobile: body.student_mobile || null,
      student_email: body.student_email || null,
      parent_email: body.parent_email || null,
      landmark: body.landmark || null,
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

// Permanent deletion, migration 0019 - Super Admin only, per explicit user
// request ("These rights should only be with super admin"). Deliberately
// checked here at the app layer (a clean 403 before we even touch the DB)
// AND inside delete_student_permanently() itself via is_super_admin() (so a
// direct RPC call some other way is still blocked) AND via the students_delete
// RLS policy (so even a raw REST DELETE against the table is blocked) - see
// the migration's comments for why this needed three layers instead of one.
// The RPC itself refuses to delete a student with any fee/payment history;
// deactivate that student instead (PATCH /api/students/[id]/status).
const deleteSchema = z.object({ reason: z.string().min(3, 'Please provide a reason.') });

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('students.write');
    if (session.role.key !== 'super_admin') {
      throw new ForbiddenError('Only Super Admin can permanently delete a student.');
    }
    const body = deleteSchema.parse(await request.json());
    const supabase = createClient();

    const { data, error } = await supabase.rpc('delete_student_permanently', {
      p_student_id: params.id,
      p_reason: body.reason
    });
    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
