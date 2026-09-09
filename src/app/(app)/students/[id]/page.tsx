import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { AssignFeeButton } from '@/components/students/AssignFeeButton';
import { GrantDiscountButton } from '@/components/students/GrantDiscountButton';

export default async function StudentDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !session.permissions.has('students.read')) redirect('/dashboard');

  const supabase = createClient();

  const { data: student } = await supabase.from('students').select('*').eq('id', params.id).eq('org_id', session.orgId).single();
  if (!student) notFound();

  const [{ data: course }, { data: batch }, { data: year }, { data: feeSummaries }, { data: availableStructures }] = await Promise.all([
    student.course_id ? supabase.from('courses').select('name').eq('id', student.course_id).single() : Promise.resolve({ data: null }),
    student.batch_id ? supabase.from('batches').select('name').eq('id', student.batch_id).single() : Promise.resolve({ data: null }),
    student.academic_year_id ? supabase.from('academic_years').select('name').eq('id', student.academic_year_id).single() : Promise.resolve({ data: null }),
    supabase.from('student_fee_summary').select('*, fee_structures(name)').eq('student_id', params.id),
    session.permissions.has('student_fees.write')
      ? supabase.from('fee_structures').select('id,name,total_fee').eq('status', 'ACTIVE').eq('org_id', session.orgId)
      : Promise.resolve({ data: [] })
  ]);

  const assignedStructureIds = new Set((feeSummaries ?? []).map((f: any) => f.fee_structure_id)); // eslint-disable-line @typescript-eslint/no-explicit-any
  const assignableStructures = (availableStructures ?? []).filter((s) => !assignedStructureIds.has(s.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="font-mono text-xs text-slate-400">{student.student_code}</p>
          <h1 className="text-xl font-semibold text-slate-900">{student.name}</h1>
          <p className="text-sm text-slate-500">
            {[course?.name, batch?.name, year?.name].filter(Boolean).join(' · ') || 'No course/batch assigned'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge status={student.status} />
          {session.permissions.has('students.write') && (
            <Link href={`/students/${student.id}/edit`} className="btn-secondary">
              Edit
            </Link>
          )}
          <Link href={`/students/${student.id}/ledger`} className="btn-secondary">
            View Ledger
          </Link>
          <Link href={`/receipts?student_id=${student.id}`} className="btn-secondary">
            View Receipts
          </Link>
          {session.permissions.has('payments.collect') && (
            <Link href={`/collect-fee?student_id=${student.id}`} className="btn-primary">
              Collect Fee
            </Link>
          )}
        </div>
      </div>

      <div className="card grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Guardian" value={student.guardian_name} />
        <Info label="Student Mobile" value={student.student_mobile} />
        <Info label="Parent Mobile" value={student.parent_mobile} />
        <Info label="Student Email" value={student.student_email} />
        <Info label="Parent Email" value={student.parent_email} />
        <Info label="Admission Number" value={student.admission_number} />
        <Info label="Admission Date" value={formatDate(student.admission_date)} />
        <Info label="Address" value={student.address} />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Fee Accounts</h2>
          {session.permissions.has('student_fees.write') && assignableStructures.length > 0 && (
            <AssignFeeButton studentId={student.id} structures={assignableStructures} />
          )}
        </div>

        {(feeSummaries ?? []).length === 0 ? (
          <div className="card p-6 text-sm text-slate-500">
            No fee structure assigned yet.
            {session.permissions.has('student_fees.write') && ' Use "Assign Fee Structure" to create one.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {(feeSummaries ?? []).map((f: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
              <div key={f.student_fee_account_id} className="card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-semibold text-slate-800">{f.fee_structures?.name ?? 'Fee Structure'}</p>
                  <Badge status={f.overall_status} />
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <Metric label="Total Fee" value={formatCurrency(f.total_fee)} />
                  <Metric label="Discount" value={formatCurrency(f.discount_total)} />
                  <Metric label="Net Fee" value={formatCurrency(f.net_fee)} />
                  <Metric label="Paid" value={formatCurrency(f.paid_total)} tone="text-emerald-700" />
                  <Metric label="Outstanding" value={formatCurrency(f.outstanding_total)} tone="text-red-700" />
                  <Metric label="Overdue" value={formatCurrency(f.overdue_amount)} tone="text-red-700" />
                </dl>
                {f.next_due_date && (
                  <p className="mt-3 text-xs text-slate-500">
                    Next due: {formatCurrency(f.next_due_amount)} on {formatDate(f.next_due_date)}
                  </p>
                )}
                {session.permissions.has('discounts.grant') && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <GrantDiscountButton accountId={f.student_fee_account_id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {student.remarks && (
        <div className="card p-4 text-sm text-slate-600">
          <span className="font-medium text-slate-800">Remarks: </span>
          {student.remarks}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm text-slate-800">{value || '-'}</p>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className={`font-semibold ${tone ?? 'text-slate-800'}`}>{value}</dd>
    </div>
  );
}
