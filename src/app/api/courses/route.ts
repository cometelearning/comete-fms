import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

// Not built on the generic createListCreateHandlers() factory (unlike the
// other master tables) because class_id needs the same '' -> null
// normalization as the PATCH route (see courses/[id]/route.ts) which the
// factory's generic insert type can't express cleanly. class_standard is
// never accepted from the client: it's derived from class_id by a database
// trigger (migration 0011).
const insertSchema = z.object({
  name: z.string().min(1),
  class_id: z.string().uuid().optional().or(z.literal('')),
  description: z.string().optional()
});

export async function GET() {
  try {
    const session = await requirePermission('masters.read');
    const supabase = createClient();
    const { data, error } = await supabase.from('courses').select('*').eq('org_id', session.orgId).order('name', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ data });
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
        class_id: parsed.class_id ? parsed.class_id : null,
        org_id: session.orgId
      })
      .select()
      .single();
    if (error) throw error;

    await supabase.rpc('write_audit_log', {
      p_action: 'COURSES_CREATED',
      p_module: 'courses',
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
