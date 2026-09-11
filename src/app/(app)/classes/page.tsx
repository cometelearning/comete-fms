import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { MasterCrudPage } from '@/components/masters/MasterCrudPage';

export default async function ClassesPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('masters.read')) redirect('/dashboard');

  return (
    <MasterCrudPage
      title="Classes"
      description="Class master, e.g. Class 10, Class 11, Class 12. Courses reference a class from here for grouping and reporting."
      apiPath="/api/classes"
      canWrite={session.permissions.has('masters.write')}
      fields={[{ name: 'name', label: 'Class name', type: 'text', required: true }]}
      columns={[{ key: 'name', label: 'Class name' }]}
    />
  );
}
