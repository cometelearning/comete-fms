import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CoursesManager } from '@/components/courses/CoursesManager';

export default async function CoursesPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('masters.read')) redirect('/dashboard');

  const supabase = createClient();
  const { data: classes } = await supabase.from('classes').select('id,name').eq('status', 'ACTIVE').order('name');

  return (
    <CoursesManager
      classes={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
      canWrite={session.permissions.has('masters.write')}
    />
  );
}
