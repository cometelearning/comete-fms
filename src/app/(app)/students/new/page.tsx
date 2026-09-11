import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { StudentForm } from '@/components/students/StudentForm';

export default async function NewStudentPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('students.write')) redirect('/students');

  const supabase = createClient();
  const canEnterFee = session.permissions.has('student_fees.write');
  const [{ data: classes }, { data: courses }, { data: years }, { data: branches }, { data: batches }, { data: boards }, feeHeadsResult] =
    await Promise.all([
      supabase.from('classes').select('id,name').eq('status', 'ACTIVE').order('name'),
      supabase.from('courses').select('id,name,course_classes(class_id)').eq('status', 'ACTIVE').order('name'),
      supabase.from('academic_years').select('id,name').order('start_date', { ascending: false }),
      supabase.from('branches').select('id,name').eq('status', 'ACTIVE').order('name'),
      supabase.from('batches').select('id,name').eq('status', 'ACTIVE').order('name'),
      supabase.from('boards').select('id,name').eq('status', 'ACTIVE').order('name'),
      canEnterFee
        ? supabase.from('fee_heads').select('id,name').eq('status', 'ACTIVE').order('name')
        : Promise.resolve({ data: null })
    ]);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Add Student</h1>
      <StudentForm
        mode="create"
        classes={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
        courses={(courses ?? []).map((c) => ({
          value: c.id,
          label: c.name,
          classIds: (c.course_classes ?? []).map((cc: { class_id: string }) => cc.class_id)
        }))}
        years={(years ?? []).map((y) => ({ value: y.id, label: y.name }))}
        branches={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
        batches={(batches ?? []).map((b) => ({ value: b.id, label: b.name }))}
        boards={(boards ?? []).map((b) => ({ value: b.id, label: b.name }))}
        feeHeads={canEnterFee ? (feeHeadsResult.data ?? []).map((f) => ({ value: f.id, label: f.name })) : undefined}
      />
    </div>
  );
}
