import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { NavShell } from '@/components/nav/NavShell';
import type { Permission } from '@/lib/types/domain';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  return (
    <NavShell
      fullName={session.profile.full_name}
      roleName={session.role.name}
      permissions={Array.from(session.permissions) as Permission[]}
    >
      {children}
    </NavShell>
  );
}
