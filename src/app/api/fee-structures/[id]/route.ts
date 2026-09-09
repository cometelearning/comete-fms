import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('fee_structures.read');
    const supabase = createClient();
    const { data, error } = await supabase
      .from('fee_structures')
      .select(
        '*, academic_years(name), courses(name), batches(name), fee_structure_items(*, fee_heads(name)), fee_structure_installments(*)'
      )
      .eq('id', params.id)
      .eq('org_id', session.orgId)
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
