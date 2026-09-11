import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

// Not built on the generic createListCreateHandlers() factory (unlike the
// other master tables) because a course now links to one or more Classes
// through the course_classes join table (migration 0016), which the
// factory has no concept of. class_standard is never accepted from the
// client: it's an auto-maintained, comma-joined summary of the linked
// classes, kept in sync by database triggers. class_ids is mandatory here
// (every course must belong to at least one Class, per the office's
// request - the Add/Edit Student form filters its Course list by the Class
// picked there, so a classless course could never be selected on a new
// student) - POST always receives the full Add Course form, so this can
// safely require it outright, unlike the PATCH schema below which must
// also accept a partial Activate/Deactivate `{status}` body.
const insertSchema = z.object({
  name: z.string().min(1),
  class_ids: z.array(z.string().uuid()).min(1),
  description: z.string().optional()
});

export async function GET() {
  try {
    const session = await requirePermission('masters.read');
    const supabase = createClient();
    const { data, error } = await supabase
      .from('courses')
      .select('*, course_classes(class_id)')
      .eq('org_id', session.orgId)
      .order('name', { ascending: true });
    if (error) throw error;

    // Flatten the joined course_classes rows into a plain class_ids array so
    // the client never has to know about the join table shape.
    const rows = (data ?? []).map((c) => {
      const { course_classes, ...rest } = c as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      return { ...rest, class_ids: (course_classes ?? []).map((cc: any) => cc.class_id) }; // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    return NextResponse.json({ data: rows });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requirePermission('masters.write');
    const parsed = insertSchema.parse(await request.json());
    const supabase = createClient();
    const { data, error } = await supabase
      .from('courses')
      .insert({
        name: parsed.name,
        description: parsed.description,
        org_id: session.orgId
      })
      .select()
      .single();
    if (error) throw error;

    // The trg_course_classes_sync_standard trigger recomputes
    // class_standard as each row lands - order doesn't matter, the final
    // aggregate converges once every row is in.
    const { error: linkError } = await supabase
      .from('course_classes')
      .insert(parsed.class_ids.map((classId) => ({ org_id: session.orgId, course_id: data.id, class_id: classId })));
    if (linkError) throw linkError;

    await supabase.rpc('write_audit_log', {
      p_action: 'COURSES_CREATED',
      p_module: 'courses',
      p_record_id: data.id,
      p_previous_value: null,
      p_new_value: { ...data, class_ids: parsed.class_ids },
      p_reason: null
    });

    return NextResponse.json({ data: { ...data, class_ids: parsed.class_ids } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
