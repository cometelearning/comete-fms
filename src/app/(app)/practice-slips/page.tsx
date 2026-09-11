import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PracticeSlipsList } from '@/components/practice-slips/PracticeSlipsList';

export default async function PracticeSlipsPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('students.read')) redirect('/dashboard');

  const supabase = createClient();
  const { data: subjects } = await supabase.from('subjects').select('id,name').eq('org_id', session.orgId).eq('status', 'ACTIVE').order('name');
  const subjectOptions = (subjects ?? []).map((s) => ({ value: s.id, label: s.name }));

  return <PracticeSlipsList subjects={subjectOptions} canWrite={session.permissions.has('students.write')} />;
}
