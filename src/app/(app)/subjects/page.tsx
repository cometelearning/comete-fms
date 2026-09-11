import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MasterCrudPage } from '@/components/masters/MasterCrudPage';

export default async function SubjectsPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('masters.read')) redirect('/dashboard');

  const supabase = createClient();
  const { data: classes } = await supabase.from('classes').select('id,name').eq('status', 'ACTIVE').order('name');
  const classOptions = (classes ?? []).map((c) => ({ value: c.id, label: c.name }));
  const classMap = Object.fromEntries((classes ?? []).map((c) => [c.id, c.name]));

  return (
    <MasterCrudPage
      title="Subjects"
      description="Subject master, grouped by Class - you fill these in once and they're then available wherever a subject needs to be picked (e.g. Practice Slip Management)."
      apiPath="/api/subjects"
      canWrite={session.permissions.has('masters.write')}
      fields={[
        { name: 'class_id', label: 'Class', type: 'select', required: true, options: classOptions },
        { name: 'name', label: 'Subject name', type: 'text', required: true }
      ]}
      columns={[
        { key: 'class_id', label: 'Class', type: 'lookup', map: classMap },
        { key: 'name', label: 'Subject name' }
      ]}
      emptyLabel="No subjects yet. Add one per Class to get started."
    />
  );
}
