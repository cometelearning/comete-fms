import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { CollectionReport } from '@/components/reports/CollectionReport';

export default async function CollectionReportPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('reports.view')) redirect('/dashboard');

  const supabase = createClient();
  const [{ data: courses }, { data: batches }, { data: users }] = await Promise.all([
    supabase.from('courses').select('id,name').order('name'),
    supabase.from('batches').select('id,name,course_id').order('name'),
    supabase.from('profiles').select('id,full_name').eq('org_id', session.orgId).order('full_name')
  ]);

  return (
    <CollectionReport
      courses={(courses ?? []).map((c) => ({ value: c.id, label: c.name }))}
      batches={(batches ?? []).map((b) => ({ value: b.id, label: b.name, courseId: b.course_id }))}
      users={(users ?? []).map((u) => ({ value: u.id, label: u.full_name }))}
      canExport={session.permissions.has('exports.run')}
    />
  );
}
