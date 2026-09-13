import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

// Same filter fields the student search screen (/api/students) accepts,
// minus pagination - a bulk assignment always resolves the FULL matching set
// server-side, never just the current page, so "select all N matching"
// behaves correctly regardless of page size or client pagination state.
const filtersSchema = z.object({
  q: z.string().optional(),
  course_id: z.string().uuid().optional(),
  class_id: z.string().uuid().optional(),
  batch_id: z.string().uuid().optional(),
  academic_year_id: z.string().uuid().optional(),
  board_id: z.string().uuid().optional(),
  branch_id: z.string().uuid().optional(),
  status: z.string().optional()
});

const bodySchema = z
  .object({
    teacher_id: z.string().uuid(),
    share_percentage: z.number().positive().max(100),
    effective_from: z.string().min(1),
    effective_to: z.string().min(1).optional(),
    selection: z.discriminatedUnion('mode', [
      z.object({ mode: z.literal('ids'), student_ids: z.array(z.string().uuid()).min(1) }),
      z.object({ mode: z.literal('filter'), filters: filtersSchema })
    ])
  })
  .refine((v) => !v.effective_to || v.effective_to >= v.effective_from, {
    message: 'Effective To cannot be before Effective From.',
    path: ['effective_to']
  });

/**
 * Bulk version of POST /api/teacher-shares (spec: "allocate multiple students
 * to a teacher... filter screen so that students of a particular course can
 * be directly allotted"). Always resolves the target student IDs itself
 * (either by re-validating a submitted ID list against this org, or by
 * re-running the same filter the browser used) rather than trusting a
 * possibly-stale or possibly-foreign list from the client, then performs one
 * bulk insert and ONE consolidated audit log entry (not one per student) so
 * assigning e.g. 120 students doesn't flood the audit trail.
 */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('settings.manage');
    const body = bodySchema.parse(await request.json());
    const supabase = createClient();

    let studentIds: string[];

    if (body.selection.mode === 'ids') {
      const { data, error } = await supabase
        .from('students')
        .select('id')
        .eq('org_id', session.orgId)
        .in('id', body.selection.student_ids);
      if (error) throw error;
      studentIds = (data ?? []).map((s) => s.id);
    } else {
      const f = body.selection.filters;
      let query = supabase.from('students').select('id').eq('org_id', session.orgId);
      if (f.q) {
        const like = `%${f.q}%`;
        query = query.or(
          `name.ilike.${like},student_code.ilike.${like},admission_number.ilike.${like},student_mobile.ilike.${like},parent_mobile.ilike.${like},student_email.ilike.${like},parent_email.ilike.${like}`
        );
      }
      if (f.course_id) query = query.eq('course_id', f.course_id);
      if (f.class_id) query = query.eq('class_id', f.class_id);
      if (f.batch_id) query = query.eq('batch_id', f.batch_id);
      if (f.academic_year_id) query = query.eq('academic_year_id', f.academic_year_id);
      if (f.board_id) query = query.eq('board_id', f.board_id);
      if (f.branch_id) query = query.eq('branch_id', f.branch_id);
      if (f.status !== 'ALL') query = query.eq('status', f.status || 'ACTIVE');

      const { data, error } = await query;
      if (error) throw error;
      studentIds = (data ?? []).map((s) => s.id);
    }

    // De-dupe defensively (a submitted ID list could contain repeats).
    studentIds = Array.from(new Set(studentIds));

    if (studentIds.length === 0) {
      throw new Error('NO_STUDENTS_MATCHED');
    }

    const rows = studentIds.map((studentId) => ({
      org_id: session.orgId,
      teacher_id: body.teacher_id,
      student_id: studentId,
      share_percentage: body.share_percentage,
      effective_from: body.effective_from,
      effective_to: body.effective_to || null,
      created_by: session.userId
    }));

    const { data, error } = await supabase.from('teacher_student_shares').insert(rows).select('id');
    if (error) throw error;

    await supabase.rpc('write_audit_log', {
      p_action: 'TEACHER_SHARE_BULK_ASSIGNED',
      p_module: 'teacher_student_shares',
      p_record_id: null,
      p_previous_value: null,
      p_new_value: {
        teacher_id: body.teacher_id,
        share_percentage: body.share_percentage,
        effective_from: body.effective_from,
        effective_to: body.effective_to || null,
        student_count: studentIds.length,
        selection: body.selection
      },
      p_reason: null
    });

    return NextResponse.json({ data: { created: data?.length ?? studentIds.length } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
