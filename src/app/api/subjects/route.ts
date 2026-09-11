import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

/**
 * Subject Master - many-to-many with Classes (migration 0022), per explicit
 * user correction: "the subjects master be created many to one, like
 * Maths, Science and english may be tagged to all the class from 6th to
 * 10th etc." One subject (e.g. "Maths") is defined once and tagged to
 * however many classes it's taught in, via the subject_classes join table -
 * so this can't use the generic masterCrud factory (single-table CRUD) and
 * is bespoke, same as practice-slips/student-performance/practice-copy-checks.
 *
 * "Should not mistake course and classes in reporting format" - this module
 * only ever relates Subjects to Classes; Course is a separate master and is
 * never touched or displayed here.
 */
const insertSchema = z.object({
  name: z.string().min(1),
  class_ids: z.array(z.string().uuid()).min(1, 'Select at least one class.')
});

export async function GET() {
  try {
    const session = await requirePermission('masters.read');
    const supabase = createClient();
    const { data, error } = await supabase
      .from('subjects')
      .select('id, name, status, created_at, subject_classes(class_id, classes(id, name))')
      .eq('org_id', session.orgId)
      .order('name', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requirePermission('masters.write');
    const body = insertSchema.parse(await request.json());
    const supabase = createClient();

    const { data: subject, error } = await supabase
      .from('subjects')
      .insert({ org_id: session.orgId, name: body.name })
      .select()
      .single();
    if (error) throw error;

    const { error: linkError } = await supabase
      .from('subject_classes')
      .insert(body.class_ids.map((class_id) => ({ org_id: session.orgId, subject_id: subject.id, class_id })));
    if (linkError) throw linkError;

    await supabase.rpc('write_audit_log', {
      p_action: 'SUBJECTS_CREATED',
      p_module: 'subjects',
      p_record_id: subject.id,
      p_previous_value: null,
      p_new_value: { ...subject, class_ids: body.class_ids },
      p_reason: null
    });
    return NextResponse.json({ data: subject }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
