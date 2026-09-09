import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/utils/format';

export default async function FeeStructuresPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('fee_structures.read')) redirect('/dashboard');

  const supabase = createClient();
  const { data: structures } = await supabase
    .from('fee_structures')
    .select('*, academic_years(name), courses(name)')
    .eq('org_id', session.orgId)
    .order('created_at', { ascending: false });

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Fee Structures</h1>
          <p className="text-sm text-slate-500">Reusable fee plans with an installment schedule, per course/academic year.</p>
        </div>
        {session.permissions.has('fee_structures.write') && (
          <Link href="/fee-structures/new" className="btn-primary">
            + New Fee Structure
          </Link>
        )}
      </div>

      <div className="card overflow-x-auto">
        {(structures ?? []).length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No fee structures yet.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Name</th>
                <th>Academic Year</th>
                <th>Course</th>
                <th className="text-right">Total Fee</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(structures ?? []).map((s: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                <tr key={s.id}>
                  <td className="font-medium text-slate-900">{s.name}</td>
                  <td>{s.academic_years?.name}</td>
                  <td>{s.courses?.name}</td>
                  <td className="text-right">{formatCurrency(s.total_fee)}</td>
                  <td>
                    <Badge status={s.status} />
                  </td>
                  <td className="text-right">
                    <Link href={`/fee-structures/${s.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
