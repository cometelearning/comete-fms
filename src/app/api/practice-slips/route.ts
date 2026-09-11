import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';
const PAGE_SIZE = 25;

/**
 * Practice Slip Management (PSMS) - a simple per-student log, following the
 * same bespoke-handlers pattern as ptm-records (needs a student join for
 * search/display/pagination, so it isn't a fit for the masterCrud factory).
 */
export async function GET(request: Request) {
  try {
    const session = await requirePermission('students.read');
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');
    const subjectId = searchParams.get('subject_id');
    const status = searchParams.get('status');
    const q = searchParams.get('q')?.trim();
    const studentStatus = searchParams.get('student_status');
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));

    let query = supabase
      .from('practice_slips')
      .select(
        'id, student_id, subject_id, slip_date, topic, level, status, checked_at, created_at, students!inner(name, student_code, status, classes(name)), subjects(name), checked_by_profile:profiles!practice_slips_checked_by_fkey(full_name)',
        { count: 'exact' }
      )
      .eq('org_id', session.orgId);

    if (studentId) query = query.eq('student_id', studentId);
    if (subjectId) query = query.eq('subject_id', subjectId);
    if (status) query = query.eq('status', status);
    // Default-hide inactive students unless a filter specifically asks for
    // them, same pattern as every other list/report since the Foundations
    // round - skipped when a specific student_id is requested.
    if (!studentId && studentStatus !== 'ALL') {
      query = query.eq('students.status', studentStatus || 'ACTIVE');
    }
    if (q) {
      const { data: matchingStudents } = await supabase
        .from('students')
        .select('id')
        .eq('org_id', session.orgId)
        .or(`name.ilike.%${q}%,student_code.ilike.%${q}%`);
      const ids = (matchingStudents ?? []).map((s) => s.id);
      query = query.in('student_id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);
    }

    query = query.order('slip_date', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ data, count, page, pageSize: PAGE_SIZE });
  } catch (error) {
    return apiError(error);
  }
}

const insertSchema = z.object({
  student_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  slip_date: z.string().min(1),
  topic: z.string().min(1),
  level: z.enum(['LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'NA'])
});

export async function POST(request: Request) {
  try {
    const session = await requirePermission('students.write');
    const body = insertSchema.parse(await request.json());
    const supabase = createClient();

    const { data, error } = await supabase
      .from('practice_slips')
      .insert({
        org_id: session.orgId,
        student_id: body.student_id,
        subject_id: body.subject_id,
        slip_date: body.slip_date,
        topic: body.topic,
        level: body.level,
        created_by: session.userId
      })
      .select()
      .single();
    if (error) throw error;

    await supabase.rpc('write_audit_log', {
      p_action: 'PRACTICE_SLIP_CREATED',
      p_module: 'practice_slips',
      p_record_id: data.id,
      p_previous_value: null,
      p_new_value: data,
      p_reason: null
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
