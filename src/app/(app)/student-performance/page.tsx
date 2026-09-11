import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { StudentPerformanceList } from '@/components/student-performance/StudentPerformanceList';

export default async function StudentPerformancePage() {
  const session = await getSession();
  if (!session || !session.permissions.has('students.read')) redirect('/dashboard');

  const supabase = createClient();
  const [{ data: subjects }, { data: teachers }] = await Promise.all([
    supabase.from('subjects').select('id,name').eq('org_id', session.orgId).eq('status', 'ACTIVE').order('name'),
    supabase.from('teachers').select('id,name').eq('org_id', session.orgId).eq('status', 'ACTIVE').order('name')
  ]);
  const subjectOptions = (subjects ?? []).map((s) => ({ value: s.id, label: s.name }));
  const teacherOptions = (teachers ?? []).map((t) => ({ value: t.id, label: t.name }));

  return (
    <StudentPerformanceList subjects={subjectOptions} teachers={teacherOptions} canWrite={session.permissions.has('students.write')} />
  );
}
