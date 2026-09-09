import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { AuditTrail } from '@/components/audit/AuditTrail';

export default async function AuditLogsPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('audit.view')) redirect('/reports');
  return <AuditTrail />;
}
