import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PracticeCopyChecksList } from '@/components/practice-copy-check/PracticeCopyChecksList';

export default async function PracticeCopyCheckPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('students.read')) redirect('/dashboard');

  const supabase = createClient();
  const { data: teachers } = await supabase.from('teachers').select('id,name').eq('org_id', session.orgId).eq('status', 'ACTIVE').order('name');
  const teacherOptions = (teachers ?? []).map((t) => ({ value: t.id, label: t.name }));

  return <PracticeCopyChecksList teachers={teacherOptions} canWrite={session.permissions.has('students.write')} />;
}
