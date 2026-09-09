import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await requirePermission('fee_structures.read');
    const supabase = createClient();
    const { data, error } = await supabase
      .from('fee_structures')
      .select('*, academic_years(name), courses(name), batches(name)')
      .eq('org_id', session.orgId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}

const itemSchema = z.object({ fee_head_id: z.string().uuid(), amount: z.number().positive() });
const installmentSchema = z.object({
  seq_no: z.number().int().positive(),
  label: z.string().min(1),
  amount: z.number().positive(),
  due_date: z.string()
});

const insertSchema = z.object({
  name: z.string().min(2),
  academic_year_id: z.string().uuid(),
  course_id: z.string().uuid(),
  batch_id: z.string().uuid().optional().nullable(),
  items: z.array(itemSchema).min(1),
  installments: z.array(installmentSchema).min(1)
});

export async function POST(request: Request) {
  try {
    await requirePermission('fee_structures.write');
    const body = insertSchema.parse(await request.json());
    const supabase = createClient();

    const { data, error } = await supabase.rpc('create_fee_structure', {
      p_name: body.name,
      p_academic_year_id: body.academic_year_id,
      p_course_id: body.course_id,
      p_batch_id: body.batch_id ?? null,
      p_items: body.items,
      p_installments: body.installments
    });
    if (error) throw error;

    return NextResponse.json({ data: { id: data } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
