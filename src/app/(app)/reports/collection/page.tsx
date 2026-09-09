import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { CollectionReport } from '@/components/reports/CollectionReport';

export default async function CollectionReportPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('reports.view')) redirect('/dashboard');

  const supabase = createClient();
  const [{ data: courses }, { data: users }] = await Promise.all([
    supabase.from('courses').select('id,name,class_standard').order('name'),
    supabase.from('profiles').select('id,full_name').eq('org_id', session.orgId).order('full_name')
  ]);

  const classOptions = Array.from(new Set((courses ?? []).map((c) => c.class_standard).filter((v): v is string => !!v))).map((v) => ({
    value: v,
    label: v
  }));

  return (
    <CollectionReport
      courses={(courses ?? []).map((c) => ({ value: c.id, label: c.name }))}
      classes={classOptions}
      users={(users ?? []).map((u) => ({ value: u.id, label: u.full_name }))}
      canExport={session.permissions.has('exports.run')}
    />
  );
}
