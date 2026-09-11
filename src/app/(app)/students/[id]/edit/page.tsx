import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { StudentForm } from '@/components/students/StudentForm';

export default async function EditStudentPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !session.permissions.has('students.write')) redirect(`/students/${params.id}`);

  const supabase = createClient();
  const [{ data: student }, { data: courses }, { data: years }, { data: branches }, { data: batches }] = await Promise.all([
    supabase.from('students').select('*').eq('id', params.id).eq('org_id', session.orgId).single(),
    supabase.from('courses').select('id,name').eq('status', 'ACTIVE').order('name'),
    supabase.from('academic_years').select('id,name').order('start_date', { ascending: false }),
    supabase.from('branches').select('id,name').eq('status', 'ACTIVE').order('name'),
    supabase.from('batches').select('id,name').eq('status', 'ACTIVE').order('name')
  ]);

  if (!student) notFound();

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Edit Student</h1>
      <StudentForm
        mode="edit"
        studentId={student.id}
        initial={student}
        courses={(courses ?? []).map((c) => ({ value: c.id, label: c.name }))}
        years={(years ?? []).map((y) => ({ value: y.id, label: y.name }))}
        branches={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
        batches={(batches ?? []).map((b) => ({ value: b.id, label: b.name }))}
      />
    </div>
  );
}
