import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { StudentRecordReport } from '@/components/reports/StudentRecordReport';

export default async function StudentRecordReportPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('reports.view')) redirect('/dashboard');

  const supabase = createClient();
  const [{ data: years }, { data: courses }, { data: branches }, { data: batches }, { data: boards }] = await Promise.all([
    supabase.from('academic_years').select('id,name').order('start_date', { ascending: false }),
    supabase.from('courses').select('id,name,class_standard').order('name'),
    supabase.from('branches').select('id,name').order('name'),
    supabase.from('batches').select('id,name').order('name'),
    supabase.from('boards').select('id,name').order('name')
  ]);

  const classOptions = Array.from(new Set((courses ?? []).map((c) => c.class_standard).filter((v): v is string => !!v))).map((v) => ({
    value: v,
    label: v
  }));

  return (
    <StudentRecordReport
      years={(years ?? []).map((y) => ({ value: y.id, label: y.name }))}
      courses={(courses ?? []).map((c) => ({ value: c.id, label: c.name }))}
      classes={classOptions}
      branches={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
      batches={(batches ?? []).map((b) => ({ value: b.id, label: b.name }))}
      boards={(boards ?? []).map((b) => ({ value: b.id, label: b.name }))}
      canExport={session.permissions.has('exports.run')}
    />
  );
}
