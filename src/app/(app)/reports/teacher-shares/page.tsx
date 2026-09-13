import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { TeacherShareReport } from '@/components/reports/TeacherShareReport';

export default async function TeacherShareReportPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('settings.manage')) redirect('/dashboard');

  const supabase = createClient();
  const { data: teachers } = await supabase.from('teachers').select('id,name').eq('org_id', session.orgId).eq('status', 'ACTIVE').order('name');
  const teacherOptions = (teachers ?? []).map((t) => ({ value: t.id, label: t.name }));

  return <TeacherShareReport teachers={teacherOptions} />;
}
