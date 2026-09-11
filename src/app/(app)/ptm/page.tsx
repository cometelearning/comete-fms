import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { PtmRecordsList } from '@/components/ptm/PtmRecordsList';

export default async function PtmPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('students.read')) redirect('/dashboard');

  return <PtmRecordsList canWrite={session.permissions.has('students.write')} />;
}
