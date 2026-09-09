import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { StatCard } from '@/components/dashboard/StatCard';
import { BarList } from '@/components/dashboard/BarList';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/format';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('dashboard.view')) redirect('/login');

  const supabase = createClient();

  const [{ data: summary, error: summaryError }, { data: recentReceipts }, { data: upcomingDue }] = await Promise.all([
    supabase.rpc('dashboard_summary'),
    supabase
      .from('receipts')
      .select('id, receipt_number, issued_at, status, payments(amount, students(name, student_code))')
      .eq('org_id', session.orgId)
      .order('issued_at', { ascending: false })
      .limit(8),
    supabase
      .from('installment_status')
      .select('id, label, amount, outstanding_amount, due_date, status, student_fee_accounts!inner(students(name, student_code))')
      .eq('org_id', session.orgId)
      .in('status', ['DUE', 'OVERDUE'])
      .order('due_date', { ascending: true })
      .limit(8)
  ]);

  if (summaryError) {
    return <p className="text-sm text-red-600">Could not load the dashboard right now. Please refresh the page.</p>;
  }

  const s = summary as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Welcome back, {session.profile.full_name.split(' ')[0]}.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's Collection" value={formatCurrency(s.today_collection)} tone="success" />
        <StatCard label="This Month's Collection" value={formatCurrency(s.month_collection)} tone="success" />
        <StatCard label="Current Academic Year Collection" value={formatCurrency(s.year_collection)} />
        <StatCard label="Total Outstanding" value={formatCurrency(s.total_outstanding)} tone="danger" />
        <StatCard label="Overdue Amount" value={formatCurrency(s.overdue_amount)} tone="danger" />
        <StatCard label="Students with Outstanding" value={String(s.students_with_outstanding)} />
        <StatCard label="Fully Paid Students" value={String(s.fully_paid_students)} tone="success" />
        <StatCard label="Active Students" value={String(s.total_students)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BarList title="This Month's Collection by Payment Mode" items={(s.collection_by_mode ?? []).map((m: any) => ({ label: m.mode, amount: Number(m.amount) }))} /> {/* eslint-disable-line @typescript-eslint/no-explicit-any */}
        <BarList title="This Month's Collection by Course" items={(s.collection_by_course ?? []).map((c: any) => ({ label: c.course, amount: Number(c.amount) }))} /> {/* eslint-disable-line @typescript-eslint/no-explicit-any */}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Recent Receipts</h3>
            <Link href="/receipts" className="text-sm text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          {(recentReceipts ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">No receipts yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(recentReceipts ?? []).map((r: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <Link href={`/receipts/${r.id}`} className="font-medium text-brand-600 hover:underline">
                      {r.receipt_number}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {r.payments?.students?.name} · {formatDateTime(r.issued_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(r.payments?.amount)}</p>
                    <Badge status={r.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Upcoming Due Fees</h3>
            <Link href="/outstanding" className="text-sm text-brand-600 hover:underline">
              View outstanding
            </Link>
          </div>
          {(upcomingDue ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">Nothing due soon.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(upcomingDue ?? []).map((i: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{i.student_fee_accounts?.students?.name}</p>
                    <p className="text-xs text-slate-400">
                      {i.label} · due {formatDate(i.due_date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(i.outstanding_amount)}</p>
                    <Badge status={i.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
