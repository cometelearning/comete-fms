import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { BulkAssignTeacherShare } from '@/components/teacher-shares/BulkAssignTeacherShare';

export default async function BulkAssignTeacherSharePage() {
  const session = await getSession();
  if (!session || !session.permissions.has('settings.manage')) redirect('/dashboard');

  const supabase = createClient();
  const [{ data: teachers }, { data: courses }, { data: classes }, { data: batches }, { data: years }] = await Promise.all([
    supabase.from('teachers').select('id,name').eq('org_id', session.orgId).eq('status', 'ACTIVE').order('name'),
    supabase.from('courses').select('id,name').eq('org_id', session.orgId).eq('status', 'ACTIVE').order('name'),
    supabase.from('classes').select('id,name').eq('org_id', session.orgId).eq('status', 'ACTIVE').order('name'),
    supabase.from('batches').select('id,name').eq('org_id', session.orgId).eq('status', 'ACTIVE').order('name'),
    supabase.from('academic_years').select('id,name').eq('org_id', session.orgId).order('start_date', { ascending: false })
  ]);

  return (
    <BulkAssignTeacherShare
      teachers={(teachers ?? []).map((t) => ({ value: t.id, label: t.name }))}
      courses={(courses ?? []).map((c) => ({ value: c.id, label: c.name }))}
      classes={(classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
      batches={(batches ?? []).map((b) => ({ value: b.id, label: b.name }))}
      academicYears={(years ?? []).map((y) => ({ value: y.id, label: y.name }))}
    />
  );
}
