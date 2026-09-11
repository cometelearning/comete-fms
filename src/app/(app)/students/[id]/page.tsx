import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { FeeAccountDialog } from '@/components/students/FeeAccountDialog';
import { GrantDiscountButton } from '@/components/students/GrantDiscountButton';
import { PtmRecordDialog } from '@/components/ptm/PtmRecordDialog';

export default async function StudentDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !session.permissions.has('students.read')) redirect('/dashboard');

  const supabase = createClient();

  const { data: student } = await supabase.from('students').select('*').eq('id', params.id).eq('org_id', session.orgId).single();
  if (!student) notFound();

  const canEnterFee = session.permissions.has('student_fees.write');
  const canWritePtm = session.permissions.has('students.write');
  const [{ data: course }, { data: year }, { data: batch }, { data: branch }, { data: board }, { data: feeSummaries }, feeHeadsResult, { data: ptmRecords }] =
    await Promise.all([
      student.course_id
        ? supabase.from('courses').select('name,class_standard').eq('id', student.course_id).single()
        : Promise.resolve({ data: null }),
      student.academic_year_id ? supabase.from('academic_years').select('name').eq('id', student.academic_year_id).single() : Promise.resolve({ data: null }),
      student.batch_id ? supabase.from('batches').select('name').eq('id', student.batch_id).single() : Promise.resolve({ data: null }),
      student.branch_id ? supabase.from('branches').select('name').eq('id', student.branch_id).single() : Promise.resolve({ data: null }),
      student.board_id ? supabase.from('boards').select('name').eq('id', student.board_id).single() : Promise.resolve({ data: null }),
      supabase.from('student_fee_summary').select('*, fee_structures(name)').eq('student_id', params.id),
      canEnterFee ? supabase.from('fee_heads').select('id,name').eq('status', 'ACTIVE').eq('org_id', session.orgId) : Promise.resolve({ data: null }),
      supabase.from('ptm_records').select('*').eq('student_id', params.id).order('ptm_date', { ascending: false })
    ]);

  const feeHeadOptions = (feeHeadsResult.data ?? []).map((f) => ({ value: f.id, label: f.name }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="font-mono text-xs text-slate-400">{student.student_code}</p>
          <h1 className="text-xl font-semibold text-slate-900">{student.name}</h1>
          <p className="text-sm text-slate-500">
            {[course?.name, year?.name].filter(Boolean).join(' · ') || 'No course/class assigned'}
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
        <Info label="Date of Birth" value={student.date_of_birth ? formatDate(student.date_of_birth) : null} />
        <Info label="Address" value={student.address} />
        <Info label="Academic Year" value={year?.name} />
        <Info label="Class" value={course?.class_standard} />
        <Info label="Course" value={course?.name} />
        <Info label="Batch" value={batch?.name} />
        <Info label="Branch" value={branch?.name} />
        <Info label="Board" value={board?.name} />
        <Info label="School Name" value={student.school_name} />
        <Info label="Last Year %" value={student.last_year_percentage} />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Fee Accounts</h2>
          {canEnterFee && (
            <FeeAccountDialog
              studentId={student.id}
              feeHeads={feeHeadOptions}
              admissionDate={student.admission_date}
              buttonLabel="+ Add Fee"
              buttonClassName="btn-primary"
            />
          )}
        </div>

        {(feeSummaries ?? []).length === 0 ? (
          <div className="card p-6 text-sm text-slate-500">
            No fee entered yet.
            {canEnterFee && ' Use "Add Fee" to enter one.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {(feeSummaries ?? []).map((f: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
              <div key={f.student_fee_account_id} className="card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-semibold text-slate-800">{f.fee_structures?.name ?? 'Fee'}</p>
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
                {(canEnterFee && Number(f.paid_total) === 0) || session.permissions.has('discounts.grant') ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
                    {canEnterFee && Number(f.paid_total) === 0 && (
                      <FeeAccountDialog
                        accountId={f.student_fee_account_id}
                        feeHeads={feeHeadOptions}
                        admissionDate={student.admission_date}
                        buttonLabel="Edit Fee"
                        buttonClassName="btn-ghost px-2 py-1 text-xs"
                      />
                    )}
                    {session.permissions.has('discounts.grant') && <GrantDiscountButton accountId={f.student_fee_account_id} />}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">PTM Records</h2>
          {canWritePtm && (
            <PtmRecordDialog
              mode="create"
              studentId={student.id}
              studentLabel={student.name}
              buttonLabel="+ Add PTM Record"
              buttonClassName="btn-primary"
            />
          )}
        </div>
        {(ptmRecords ?? []).length === 0 ? (
          <div className="card p-6 text-sm text-slate-500">
            No PTM records yet.
            {canWritePtm && ' Use "Add PTM Record" to log one.'}
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Date of PTM</th>
                  <th>Attended</th>
                  <th>Parent&apos;s Remarks</th>
                  <th>Counsellor Remarks</th>
                  {canWritePtm && <th></th>}
                </tr>
              </thead>
              <tbody>
                {(ptmRecords ?? []).map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.ptm_date)}</td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.attended ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {r.attended ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="max-w-xs">{r.parent_remarks ?? '-'}</td>
                    <td className="max-w-xs">{r.counsellor_remarks ?? '-'}</td>
                    {canWritePtm && (
                      <td className="whitespace-nowrap text-right">
                        <PtmRecordDialog
                          mode="edit"
                          recordId={r.id}
                          studentLabel={student.name}
                          initial={{
                            ptm_date: r.ptm_date,
                            attended: r.attended,
                            parent_remarks: r.parent_remarks,
                            counsellor_remarks: r.counsellor_remarks
                          }}
                          buttonLabel="Edit"
                          buttonClassName="btn-ghost px-2 py-1 text-xs"
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(student.remarks || student.parent_remarks) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {student.remarks && (
            <div className="card p-4 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Remarks: </span>
              {student.remarks}
            </div>
          )}
          {student.parent_remarks && (
            <div className="card p-4 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Parent&apos;s Remarks: </span>
              {student.parent_remarks}
            </div>
          )}
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
