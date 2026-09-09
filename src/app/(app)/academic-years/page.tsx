import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { MasterCrudPage } from '@/components/masters/MasterCrudPage';

export default async function AcademicYearsPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('masters.read')) redirect('/dashboard');

  return (
    <MasterCrudPage
      title="Academic Years"
      description="Every fee account is linked to an academic year. Historical years stay accessible."
      apiPath="/api/academic-years"
      canWrite={session.permissions.has('masters.write')}
      fields={[
        { name: 'name', label: 'Name (e.g. 2026-27)', type: 'text', required: true },
        { name: 'start_date', label: 'Start date', type: 'date', required: true },
        { name: 'end_date', label: 'End date', type: 'date', required: true },
        { name: 'is_current', label: 'Mark as current academic year', type: 'checkbox' }
      ]}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'start_date', label: 'Start date' },
        { key: 'end_date', label: 'End date' },
        { key: 'is_current', label: 'Current', type: 'boolean' }
      ]}
    />
  );
}
