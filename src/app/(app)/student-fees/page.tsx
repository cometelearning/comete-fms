import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { StudentFeesList } from '@/components/student-fees/StudentFeesList';

export default async function StudentFeesPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('student_fees.read')) redirect('/dashboard');
  return <StudentFeesList />;
}
