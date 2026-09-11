import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';
import { fetchStudentAcademicReportData } from '@/lib/reports/studentAcademicReport';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('students.read');
    const supabase = createClient();
    const data = await fetchStudentAcademicReportData(supabase, session.orgId, params.id);
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
