import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { UsersManager } from '@/components/users/UsersManager';

export default async function UsersPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('users.manage')) redirect('/dashboard');

  const supabase = createClient();
  const { data: roles } = await supabase.from('roles').select('id,name').eq('org_id', session.orgId).order('name');

  return <UsersManager roles={roles ?? []} currentUserId={session.userId} />;
}
