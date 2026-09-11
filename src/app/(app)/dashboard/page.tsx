import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { StatCard } from '@/components/dashboard/StatCard';
import { BarList } from '@/components/dashboard/BarList';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/format';

export default async function DashboardPage({
  searchParams
}: {
  searchParams: {
    academic_year_id?: string;
    course_id?: string;
    class_id?: string;
    branch_id?: string;
    batch_id?: string;
    board_id?: string;
  };
}) {
  const session = await getSession();
  if (!session || !session.permissions.has('dashboard.view')) redirect('/login');

  const supabase = createClient();

  const academicYearId = searchParams.academic_year_id || null;
  const courseId = searchParams.course_id || null;
  const classId = searchParams.class_id || null;
  const branchId = searchParams.branch_id || null;
  const batchId = searchParams.batch_id || null;
  const boardId = searchParams.board_id || null;

  const [
    { data: summary, error: summaryError },
    { data: recentReceipts },
    { data: upcomingDue },
    { data: years },
    { data: courses },
    { data: classes },
    { data: branches },
    { data: batches },
    { data: boards }
  ] = await Promise.all([
    supabase.rpc('dashboard_summary', {
      p_academic_year_id: academicYearId,
      p_course_id: courseId,
      p_class_id: classId,
      p_branch_id: branchId,
      p_batch_id: batchId,
      p_board_id: boardId
    }),
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
      .limit(8),
    supabase.from('academic_years').select('id,name').order('start_date', { ascending: false }),
    supabase.from('courses').select('id,name').eq('status', 'ACTIVE').order('name'),
    supabase.from('classes').select('id,name').eq('status', 'ACTIVE').order('name'),
    supabase.from('branches').select('id,name').eq('status', 'ACTIVE').order('name'),
    supabase.from('batches').select('id,name').eq('status', 'ACTIVE').order('name'),
    supabase.from('boards').select('id,name').eq('status', 'ACTIVE').order('name')
  ]);

  if (summaryError) {
    return <p className="text-sm text-red-600">Could not load the dashboard right now. Please refresh the page.</p>;
  }

  const s = summary as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const yearOptions = (years ?? []).map((y) => ({ value: y.id, label: y.name }));
  const courseOptions = (courses ?? []).map((c) => ({ value: c.id, label: c.name }));
  const classOptions = (classes ?? []).map((c) => ({ value: c.id, label: c.name }));
  const branchOptions = (branches ?? []).map((b) => ({ value: b.id, label: b.name }));
  const batchOptions = (batches ?? []).map((b) => ({ value: b.id, label: b.name }));
  const boardOptions = (boards ?? []).map((b) => ({ value: b.id, label: b.name }));

  const hasAnyFilter = academicYearId || courseId || classId || branchId || batchId || boardId;
  const collectionLabel = hasAnyFilter ? 'Filtered Collection' : "Current Academic Year Collection";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Welcome back, {session.profile.full_name.split(' ')[0]}.</p>
      </div>

      <DashboardFilters
        years={yearOptions}
        courses={courseOptions}
        classes={classOptions}
        branches={branchOptions}
        batches={batchOptions}
        boards={boardOptions}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's Collection" value={formatCurrency(s.today_collection)} tone="success" />
        <StatCard label="This Month's Collection" value={formatCurrency(s.month_collection)} tone="success" />
        <StatCard label={collectionLabel} value={formatCurrency(s.year_collection)} />
        <StatCard label="Total Outstanding" value={formatCurrency(s.total_outstanding)} tone="danger" />
        <StatCard label="Overdue Amount" value={formatCurrency(s.overdue_amount)} tone="danger" />
        <StatCard label="Students with Outstanding" value={String(s.students_with_outstanding)} />
        <StatCard label="Fully Paid Students" value={String(s.fully_paid_students)} tone="success" />
        <StatCard label="Active Students" value={String(s.total_students)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <BarList title="This Month's Collection by Payment Mode" items={(s.collection_by_mode ?? []).map((m: any) => ({ label: m.mode, amount: Number(m.amount) }))} /> {/* eslint-disable-line @typescript-eslint/no-explicit-any */}
        <BarList title="This Month's Collection by Class" items={(s.collection_by_class ?? []).map((c: any) => ({ label: c.class, amount: Number(c.amount) }))} /> {/* eslint-disable-line @typescript-eslint/no-explicit-any */}
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
