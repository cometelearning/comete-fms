import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { MasterCrudPage } from '@/components/masters/MasterCrudPage';

export default async function TeachersPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('masters.read')) redirect('/dashboard');

  return (
    <MasterCrudPage
      title="Teachers"
      description="Teacher master - just a name list, so a teacher can be picked from a dropdown on future academic records. Not a login account."
      apiPath="/api/teachers"
      canWrite={session.permissions.has('masters.write')}
      fields={[{ name: 'name', label: 'Teacher name', type: 'text', required: true }]}
      columns={[{ key: 'name', label: 'Teacher name' }]}
      emptyLabel="No teachers yet."
    />
  );
}
