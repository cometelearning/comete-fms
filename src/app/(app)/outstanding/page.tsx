import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { OutstandingTable } from '@/components/outstanding/OutstandingTable';

export default async function OutstandingPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('outstanding.view')) redirect('/dashboard');

  const supabase = createClient();
  const [{ data: years }, { data: courses }, { data: batches }] = await Promise.all([
    supabase.from('academic_years').select('id,name').order('start_date', { ascending: false }),
    supabase.from('courses').select('id,name').eq('status', 'ACTIVE').order('name'),
    supabase.from('batches').select('id,name,course_id').eq('status', 'ACTIVE').order('name')
  ]);

  return (
    <OutstandingTable
      years={(years ?? []).map((y) => ({ value: y.id, label: y.name }))}
      courses={(courses ?? []).map((c) => ({ value: c.id, label: c.name }))}
      batches={(batches ?? []).map((b) => ({ value: b.id, label: b.name, courseId: b.course_id }))}
      canExport={session.permissions.has('exports.run')}
    />
  );
}
