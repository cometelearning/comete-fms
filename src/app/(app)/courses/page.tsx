import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { MasterCrudPage } from '@/components/masters/MasterCrudPage';

export default async function CoursesPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('masters.read')) redirect('/dashboard');

  return (
    <MasterCrudPage
      title="Courses / Classes"
      description="Every course or class you run, e.g. Class 10, Class 12 Commerce, CA Foundation. Fill in Class / Standard to group several courses under the same class for reporting."
      apiPath="/api/courses"
      canWrite={session.permissions.has('masters.write')}
      fields={[
        { name: 'name', label: 'Course name', type: 'text', required: true },
        { name: 'class_standard', label: 'Class / Standard', type: 'text' },
        { name: 'description', label: 'Description', type: 'textarea' }
      ]}
      columns={[
        { key: 'name', label: 'Course name' },
        { key: 'class_standard', label: 'Class / Standard' },
        { key: 'description', label: 'Description' }
      ]}
    />
  );
}
