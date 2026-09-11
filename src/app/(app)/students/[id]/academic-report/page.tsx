import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { StudentAcademicReport } from '@/components/students/StudentAcademicReport';

export default async function StudentAcademicReportPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !session.permissions.has('students.read')) redirect('/dashboard');

  return <StudentAcademicReport studentId={params.id} />;
}
