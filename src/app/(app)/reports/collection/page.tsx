import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { CollectionReport } from '@/components/reports/CollectionReport';

export default async function CollectionReportPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('reports.view')) redirect('/dashboard');

  const supabase = createClient();
  const [{ data: courses }, { data: classes }, { data: users }] = await Promise.all([
    supabase.from('courses').select('id,name').order('name'),
    supabase.from('classes').select('id,name').order('name'),
    supabase.from('profiles').select('id,full_name').eq('org_id', session.orgId).order('full_name')
  ]);

  return (
    <CollectionReport
      courses={(courses ?? []).map((c) => ({ value: c.id, label: c.name }))}
      classes={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
      users={(users ?? []).map((u) => ({ value: u.id, label: u.full_name }))}
      canExport={session.permissions.has('exports.run')}
    />
  );
}
