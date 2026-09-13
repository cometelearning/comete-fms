import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';
import { fetchTeacherShareReport } from '@/lib/reports/teacherShareReport';

export const runtime = 'nodejs';

function monthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const session = await requirePermission('settings.manage');
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacher_id');
    const from = searchParams.get('from') || monthStart();
    const to = searchParams.get('to') || todayStr();

    const result = await fetchTeacherShareReport(supabase, session.orgId, { teacherId, from, to });
    return NextResponse.json({ data: result, from, to });
  } catch (error) {
    return apiError(error);
  }
}
