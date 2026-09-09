import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { StudentSearch } from '@/components/students/StudentSearch';

export default async function StudentsPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('students.read')) redirect('/dashboard');

  return <StudentSearch canWrite={session.permissions.has('students.write')} />;
}
