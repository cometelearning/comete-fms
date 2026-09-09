import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { ReceiptView } from '@/components/receipts/ReceiptView';

export default async function ReceiptDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !session.permissions.has('receipts.read')) redirect('/dashboard');

  return <ReceiptView receiptId={params.id} canCancel={session.permissions.has('receipts.cancel')} />;
}
