import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MasterCrudPage } from '@/components/masters/MasterCrudPage';

export default async function BatchesPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('masters.read')) redirect('/dashboard');

  const supabase = createClient();
  const [{ data: courses }, { data: years }] = await Promise.all([
    supabase.from('courses').select('id,name').eq('status', 'ACTIVE').order('name'),
    supabase.from('academic_years').select('id,name').order('start_date', { ascending: false })
  ]);

  const courseOptions = (courses ?? []).map((c) => ({ value: c.id, label: c.name }));
  const yearOptions = (years ?? []).map((y) => ({ value: y.id, label: y.name }));
  // Plain objects, not Map instances - only JSON-serializable data can be
  // passed as a prop from this server component to the client component.
  const courseMap = Object.fromEntries((courses ?? []).map((c) => [c.id, c.name]));
  const yearMap = Object.fromEntries((years ?? []).map((y) => [y.id, y.name]));

  return (
    <MasterCrudPage
      title="Batches"
      description="Batch master, linked to a course and an academic year."
      apiPath="/api/batches"
      canWrite={session.permissions.has('masters.write')}
      fields={[
        { name: 'name', label: 'Batch name', type: 'text', required: true },
        { name: 'course_id', label: 'Course', type: 'select', required: true, options: courseOptions },
        { name: 'academic_year_id', label: 'Academic Year', type: 'select', required: true, options: yearOptions }
      ]}
      columns={[
        { key: 'name', label: 'Batch name' },
        { key: 'course_id', label: 'Course', type: 'lookup', map: courseMap },
        { key: 'academic_year_id', label: 'Academic Year', type: 'lookup', map: yearMap }
      ]}
    />
  );
}
