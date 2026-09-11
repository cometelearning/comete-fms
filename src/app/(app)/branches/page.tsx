import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { MasterCrudPage } from '@/components/masters/MasterCrudPage';

export default async function BranchesPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('masters.read')) redirect('/dashboard');

  return (
    <MasterCrudPage
      title="Branches"
      description="Branch master for your centers/locations. Batches and students reference a branch from here."
      apiPath="/api/branches"
      canWrite={session.permissions.has('masters.write')}
      fields={[{ name: 'name', label: 'Branch name', type: 'text', required: true }]}
      columns={[{ key: 'name', label: 'Branch name' }]}
    />
  );
}
