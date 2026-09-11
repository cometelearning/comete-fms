import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';

export const runtime = 'nodejs';

/**
 * The full permission catalog (key/description/category), for the Roles &
 * Permissions screen to render a checkbox per permission, grouped by
 * category. The `permissions` table is readable by anyone per RLS
 * (`permissions_select using (true)`), but this route is still gated to
 * `users.manage` since the catalog is only ever shown in that admin screen.
 */
export async function GET() {
  try {
    await requirePermission('users.manage');
    const supabase = createClient();
    const { data, error } = await supabase.from('permissions').select('key,description,category').order('category').order('key');
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
