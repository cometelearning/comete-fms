import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { OutstandingTable } from '@/components/outstanding/OutstandingTable';

export default async function OutstandingPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('outstanding.view')) redirect('/dashboard');

  const supabase = createClient();
  const [{ data: years }, { data: courses }] = await Promise.all([
    supabase.from('academic_years').select('id,name').order('start_date', { ascending: false }),
    supabase.from('courses').select('id,name,class_standard').eq('status', 'ACTIVE').order('name')
  ]);

  const classOptions = Array.from(new Set((courses ?? []).map((c) => c.class_standard).filter((v): v is string => !!v))).map((v) => ({
    value: v,
    label: v
  }));

  return (
    <OutstandingTable
      years={(years ?? []).map((y) => ({ value: y.id, label: y.name }))}
      courses={(courses ?? []).map((c) => ({ value: c.id, label: c.name }))}
      classes={classOptions}
      canExport={session.permissions.has('exports.run')}
    />
  );
}
