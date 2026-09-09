import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { FeeStructureBuilder } from '@/components/fee-structures/FeeStructureBuilder';

export default async function NewFeeStructurePage() {
  const session = await getSession();
  if (!session || !session.permissions.has('fee_structures.write')) redirect('/fee-structures');

  const supabase = createClient();
  const [{ data: years }, { data: courses }, { data: feeHeads }] = await Promise.all([
    supabase.from('academic_years').select('id,name').order('start_date', { ascending: false }),
    supabase.from('courses').select('id,name').eq('status', 'ACTIVE').order('name'),
    supabase.from('fee_heads').select('id,name').eq('status', 'ACTIVE').order('name')
  ]);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">New Fee Structure</h1>
      <FeeStructureBuilder
        years={(years ?? []).map((y) => ({ value: y.id, label: y.name }))}
        courses={(courses ?? []).map((c) => ({ value: c.id, label: c.name }))}
        feeHeads={(feeHeads ?? []).map((f) => ({ value: f.id, label: f.name }))}
      />
    </div>
  );
}
