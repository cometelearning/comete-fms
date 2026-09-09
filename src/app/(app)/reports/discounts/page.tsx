import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { DiscountRegister } from '@/components/reports/DiscountRegister';

export default async function DiscountsReportPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('reports.view')) redirect('/dashboard');
  return <DiscountRegister canReverse={session.permissions.has('discounts.grant')} />;
}
