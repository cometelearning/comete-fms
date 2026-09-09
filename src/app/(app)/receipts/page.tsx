import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { ReceiptRegister } from '@/components/receipts/ReceiptRegister';

export default async function ReceiptsPage({ searchParams }: { searchParams: { student_id?: string; status?: string } }) {
  const session = await getSession();
  if (!session || !session.permissions.has('receipts.read')) redirect('/dashboard');
  return <ReceiptRegister initialStudentId={searchParams.student_id} initialStatus={searchParams.status} />;
}
