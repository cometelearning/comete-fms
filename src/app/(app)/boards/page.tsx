import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { MasterCrudPage } from '@/components/masters/MasterCrudPage';

export default async function BoardsPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('masters.read')) redirect('/dashboard');

  return (
    <MasterCrudPage
      title="Boards"
      description="Board master, e.g. CBSE, ICSE, State Board. Referenced from the student profile."
      apiPath="/api/boards"
      canWrite={session.permissions.has('masters.write')}
      fields={[{ name: 'name', label: 'Board name', type: 'text', required: true }]}
      columns={[{ key: 'name', label: 'Board name' }]}
    />
  );
}
