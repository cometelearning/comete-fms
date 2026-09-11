import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';
const PAGE_SIZE = 25;

/**
 * PTM (Parent-Teacher Meeting) records - a simple per-student log, not a
 * master table, so it gets bespoke handlers rather than the masterCrud
 * factory (it needs a student join for search/display and pagination).
 */
export async function GET(request: Request) {
  try {
    const session = await requirePermission('students.read');
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');
    const q = searchParams.get('q')?.trim();
    const attended = searchParams.get('attended');
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));

    let query = supabase
      .from('ptm_records')
      .select('id, student_id, ptm_date, attended, parent_remarks, counsellor_remarks, created_at, students(name, student_code)', {
        count: 'exact'
      })
      .eq('org_id', session.orgId);

    if (studentId) query = query.eq('student_id', studentId);
    if (attended === 'true') query = query.eq('attended', true);
    if (attended === 'false') query = query.eq('attended', false);
    if (q) {
      const { data: matchingStudents } = await supabase
        .from('students')
        .select('id')
        .eq('org_id', session.orgId)
        .or(`name.ilike.%${q}%,student_code.ilike.%${q}%`);
      const ids = (matchingStudents ?? []).map((s) => s.id);
      query = query.in('student_id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);
    }

    query = query.order('ptm_date', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ data, count, page, pageSize: PAGE_SIZE });
  } catch (error) {
    return apiError(error);
  }
}

const insertSchema = z.object({
  student_id: z.string().uuid(),
  ptm_date: z.string().min(1),
  attended: z.boolean(),
  parent_remarks: z.string().optional(),
  counsellor_remarks: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const session = await requirePermission('students.write');
    const body = insertSchema.parse(await request.json());
    const supabase = createClient();

    const { data, error } = await supabase
      .from('ptm_records')
      .insert({
        org_id: session.orgId,
        student_id: body.student_id,
        ptm_date: body.ptm_date,
        attended: body.attended,
        parent_remarks: body.parent_remarks || null,
        counsellor_remarks: body.counsellor_remarks || null,
        created_by: session.userId
      })
      .select()
      .single();
    if (error) throw error;

    await supabase.rpc('write_audit_log', {
      p_action: 'PTM_RECORD_CREATED',
      p_module: 'ptm_records',
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
