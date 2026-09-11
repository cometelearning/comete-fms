import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SubjectsList } from '@/components/subjects/SubjectsList';

export default async function SubjectsPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('masters.read')) redirect('/dashboard');

  const supabase = createClient();
  const { data: classes } = await supabase.from('classes').select('id,name').eq('status', 'ACTIVE').order('name');
  const classOptions = (classes ?? []).map((c) => ({ value: c.id, label: c.name }));

  return <SubjectsList classes={classOptions} canWrite={session.permissions.has('masters.write')} />;
}
