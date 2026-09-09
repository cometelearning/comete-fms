import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { CollectFee } from '@/components/collect-fee/CollectFee';

export default async function CollectFeePage({ searchParams }: { searchParams: { student_id?: string } }) {
  const session = await getSession();
  if (!session || !session.permissions.has('payments.collect')) redirect('/dashboard');

  return <CollectFee initialStudentId={searchParams.student_id} />;
}
