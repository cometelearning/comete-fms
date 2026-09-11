import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MasterCrudPage } from '@/components/masters/MasterCrudPage';

export default async function CoursesPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('masters.read')) redirect('/dashboard');

  const supabase = createClient();
  const { data: classes } = await supabase.from('classes').select('id,name').eq('status', 'ACTIVE').order('name');

  const classOptions = (classes ?? []).map((c) => ({ value: c.id, label: c.name }));
  // Plain object, not a Map instance - only JSON-serializable data can be
  // passed as a prop from this server component to the client component.
  const classMap = Object.fromEntries((classes ?? []).map((c) => [c.id, c.name]));

  return (
    <MasterCrudPage
      title="Courses"
      description="Every course you run, e.g. CA Foundation, Class 12 Commerce. Every course belongs to one Class from Class Master - the Add/Edit Student form uses this link to only show the courses that belong to the Class picked there."
      apiPath="/api/courses"
      canWrite={session.permissions.has('masters.write')}
      fields={[
        { name: 'name', label: 'Course name', type: 'text', required: true },
        { name: 'class_id', label: 'Class', type: 'select', options: classOptions, required: true },
        { name: 'description', label: 'Description', type: 'textarea' }
      ]}
      columns={[
        { key: 'name', label: 'Course name' },
        { key: 'class_id', label: 'Class', type: 'lookup', map: classMap },
        { key: 'description', label: 'Description' }
      ]}
    />
  );
}
