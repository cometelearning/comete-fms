import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';
const PAGE_SIZE = 25;

/**
 * Teacher Tuition Share rules (migration 0023) - "Individually assigned
 * students" / "Percentage only" per explicit user choice: a teacher holds a
 * % share of the TUITION portion (only, calculated in
 * src/lib/reports/teacherShareReport.ts) of one specific student's
 * collections. Gated on settings.manage (not students.read/write, unlike
 * every other academics module) since this is compensation-like, sensitive
 * configuration.
 */
export async function GET(request: Request) {
  try {
    const session = await requirePermission('settings.manage');
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacher_id');
    const status = searchParams.get('status');
    const q = searchParams.get('q')?.trim();
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));

    let query = supabase
      .from('teacher_student_shares')
      .select('*, teachers(name), students(name, student_code, status, classes(name))', { count: 'exact' })
      .eq('org_id', session.orgId);

    if (teacherId) query = query.eq('teacher_id', teacherId);
    if (status) query = query.eq('status', status);
    if (q) {
      const { data: matchingStudents } = await supabase
        .from('students')
        .select('id')
        .eq('org_id', session.orgId)
        .or(`name.ilike.%${q}%,student_code.ilike.%${q}%`);
      const ids = (matchingStudents ?? []).map((s) => s.id);
      query = query.in('student_id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);
    }

    query = query.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ data, count, page, pageSize: PAGE_SIZE });
  } catch (error) {
    return apiError(error);
  }
}

const insertSchema = z
  .object({
    teacher_id: z.string().uuid(),
    student_id: z.string().uuid(),
    share_percentage: z.number().positive().max(100),
    effective_from: z.string().min(1),
    effective_to: z.string().min(1).optional()
  })
  .refine((v) => !v.effective_to || v.effective_to >= v.effective_from, {
    message: 'Effective To cannot be before Effective From.',
    path: ['effective_to']
  });

export async function POST(request: Request) {
  try {
    const session = await requirePermission('settings.manage');
    const body = insertSchema.parse(await request.json());
    const supabase = createClient();

    const { data, error } = await supabase
      .from('teacher_student_shares')
      .insert({
        org_id: session.orgId,
        teacher_id: body.teacher_id,
        student_id: body.student_id,
        share_percentage: body.share_percentage,
        effective_from: body.effective_from,
        effective_to: body.effective_to || null,
        created_by: session.userId
      })
      .select()
      .single();
    if (error) throw error;

    await supabase.rpc('write_audit_log', {
      p_action: 'TEACHER_SHARE_CREATED',
      p_module: 'teacher_student_shares',
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
