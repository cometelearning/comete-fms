import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

// Not built on the generic createItemHandlers() factory (unlike the other
// master tables) because a course's Classes are a many-to-many link
// (course_classes, migration 0016), which the factory has no concept of.
// class_ids stays .optional() here so the Activate/Deactivate
// `{status}`-only PATCH keeps working untouched - when class_ids IS sent
// (a real Edit Course save), the handler below replaces every
// course_classes row for this course in one delete+insert; when it's
// absent, course_classes isn't touched at all. Class is still required in
// practice on every real edit, because the Edit Course form's checkboxes
// won't submit with none checked. class_standard is never accepted from
// the client: it's an auto-maintained summary kept in sync by database
// triggers.
const updateSchema = z.object({
  name: z.string().min(1).optional(),
  class_ids: z.array(z.string().uuid()).min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional()
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('masters.write');
    const parsed = updateSchema.parse(await request.json());
    const { class_ids, ...courseFields } = parsed;

    const supabase = createClient();
    const { data: previous } = await supabase
      .from('courses')
      .select('*, course_classes(class_id)')
      .eq('id', params.id)
      .eq('org_id', session.orgId)
      .single();

    const { data, error } = await supabase
      .from('courses')
      .update(courseFields)
      .eq('id', params.id)
      .eq('org_id', session.orgId)
      .select()
      .single();
    if (error) throw error;

    if (class_ids) {
      // Replace the full set of tags rather than diffing - simplest correct
      // approach for a small per-course list, and each write is scoped to
      // org_id so it can never touch another organization's rows.
      const { error: deleteError } = await supabase
        .from('course_classes')
        .delete()
        .eq('course_id', params.id)
        .eq('org_id', session.orgId);
      if (deleteError) throw deleteError;

      const { error: linkError } = await supabase
        .from('course_classes')
        .insert(class_ids.map((classId) => ({ org_id: session.orgId, course_id: params.id, class_id: classId })));
      if (linkError) throw linkError;
    }

    await supabase.rpc('write_audit_log', {
      p_action: 'COURSES_UPDATED',
      p_module: 'courses',
      p_record_id: params.id,
      p_previous_value: previous
        ? { ...previous, class_ids: (previous.course_classes ?? []).map((cc: { class_id: string }) => cc.class_id) }
        : null,
      p_new_value: class_ids ? { ...data, class_ids } : data,
      p_reason: null
    });

    return NextResponse.json({ data: class_ids ? { ...data, class_ids } : data });
  } catch (error) {
    return apiError(error);
  }
}
