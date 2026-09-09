import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/utils/format';

export default async function FeeStructureDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !session.permissions.has('fee_structures.read')) redirect('/dashboard');

  const supabase = createClient();
  const { data: structure } = await supabase
    .from('fee_structures')
    .select(
      '*, academic_years(name), courses(name), fee_structure_items(*, fee_heads(name)), fee_structure_installments(*)'
    )
    .eq('id', params.id)
    .eq('org_id', session.orgId)
    .single();

  if (!structure) notFound();

  const items = (structure.fee_structure_items ?? []).sort((a: any, b: any) => (a.fee_heads?.name ?? '').localeCompare(b.fee_heads?.name ?? '')); // eslint-disable-line @typescript-eslint/no-explicit-any
  const installments = (structure.fee_structure_installments ?? []).sort((a: any, b: any) => a.seq_no - b.seq_no); // eslint-disable-line @typescript-eslint/no-explicit-any

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{structure.name}</h1>
          <p className="text-sm text-slate-500">
            {structure.academic_years?.name} · {structure.courses?.name}
          </p>
        </div>
        <Badge status={structure.status} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="mb-3 font-semibold text-slate-800">Fee Heads</h2>
          <table className="table-base">
            <thead>
              <tr>
                <th>Fee Head</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                <tr key={i.id}>
                  <td>{i.fee_heads?.name}</td>
                  <td className="text-right">{formatCurrency(i.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td>Total</td>
                <td className="text-right">{formatCurrency(structure.total_fee)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="card p-6">
          <h2 className="mb-3 font-semibold text-slate-800">Installment Schedule</h2>
          <table className="table-base">
            <thead>
              <tr>
                <th>Installment</th>
                <th className="text-right">Amount</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {installments.map((i: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                <tr key={i.id}>
                  <td>{i.label}</td>
                  <td className="text-right">{formatCurrency(i.amount)}</td>
                  <td>{formatDate(i.due_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
