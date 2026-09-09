import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { StudentForm } from '@/components/students/StudentForm';

export default async function NewStudentPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('students.write')) redirect('/students');

  const supabase = createClient();
  const [{ data: courses }, { data: batches }, { data: years }] = await Promise.all([
    supabase.from('courses').select('id,name').eq('status', 'ACTIVE').order('name'),
    supabase.from('batches').select('id,name,course_id').eq('status', 'ACTIVE').order('name'),
    supabase.from('academic_years').select('id,name').order('start_date', { ascending: false })
  ]);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Add Student</h1>
      <StudentForm
        mode="create"
        courses={(courses ?? []).map((c) => ({ value: c.id, label: c.name }))}
        batches={(batches ?? []).map((b) => ({ value: b.id, label: b.name, courseId: b.course_id }))}
        years={(years ?? []).map((y) => ({ value: y.id, label: y.name }))}
      />
    </div>
  );
}
