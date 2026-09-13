import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { MasterCrudPage } from '@/components/masters/MasterCrudPage';

export default async function FeeHeadsPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('masters.read')) redirect('/dashboard');

  return (
    <MasterCrudPage
      title="Fee Heads"
      description="Configurable fee components used when building fee structures, e.g. Tuition Fee, Admission Fee, Study Material."
      apiPath="/api/fee-heads"
      canWrite={session.permissions.has('masters.write')}
      fields={[
        { name: 'name', label: 'Fee head name', type: 'text', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
        {
          name: 'is_tuition',
          label: 'This is the Tuition Fee head (used to calculate teacher tuition shares - only one fee head may be marked)',
          type: 'checkbox'
        }
      ]}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'description', label: 'Description' },
        { key: 'is_tuition', label: 'Tuition Fee', type: 'boolean' }
      ]}
    />
  );
}
