import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatCurrency, formatDate } from '@/lib/utils/format';

export default async function StudentLedgerPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !session.permissions.has('student_fees.read')) redirect('/dashboard');

  const supabase = createClient();
  const { data: student } = await supabase.from('students').select('id,name,student_code').eq('id', params.id).eq('org_id', session.orgId).single();
  if (!student) notFound();

  const { data: entries } = await supabase
    .from('student_ledger')
    .select('*')
    .eq('student_id', params.id)
    .order('entry_at', { ascending: true })
    .order('sort_order', { ascending: true });

  return (
    <div>
      <div className="mb-6">
        <p className="font-mono text-xs text-slate-400">{student.student_code}</p>
        <h1 className="text-xl font-semibold text-slate-900">{student.name} - Fee Ledger</h1>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Date</th>
              <th>Particulars</th>
              <th className="text-right">Debit</th>
              <th className="text-right">Credit</th>
              <th className="text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {(entries ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-sm text-slate-500">
                  No ledger entries yet.
                </td>
              </tr>
            ) : (
              (entries ?? []).map((e, idx) => (
                <tr key={`${e.ref_id}-${idx}`}>
                  <td>{formatDate(e.entry_at)}</td>
                  <td>{e.particulars}</td>
                  <td className="text-right">{e.debit ? formatCurrency(e.debit) : ''}</td>
                  <td className="text-right">{e.credit ? formatCurrency(e.credit) : ''}</td>
                  <td className="text-right font-medium">{formatCurrency(e.balance)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-400">Balance shown is the outstanding amount owed by the student at each point in time.</p>
    </div>
  );
}
