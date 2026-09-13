'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency, studentDisplayName } from '@/lib/utils/format';
import type { FieldOption } from '@/components/masters/MasterCrudPage';

function monthStartStr(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TeacherShareReport({ teachers }: { teachers: FieldOption[] }) {
  const [teacherId, setTeacherId] = useState('');
  const [from, setFrom] = useState(monthStartStr());
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (teacherId) params.set('teacher_id', teacherId);
    params.set('from', from);
    params.set('to', to);
    fetch(`/api/reports/teacher-shares?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setData(d.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, [teacherId, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Teacher Share Report</h1>
        <p className="text-sm text-slate-500">
          Each teacher&apos;s share of Tuition Fee actually collected in the period, calculated from real payments - never a manually-entered
          figure. Admission, Study Material and Examination Fee are always deducted first; only fees collected beyond that count as Tuition.
        </p>
      </div>

      <div className="card mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
        <select className="input" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
          <option value="">All teachers</option>
          {teachers.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <p className="p-6 text-sm text-slate-500">Loading…</p>
      ) : !data?.configured ? (
        <div className="card p-6 text-sm text-slate-600">
          No fee head is marked as the Tuition Fee head yet, so nothing can be calculated. Mark one in{' '}
          <Link href="/fee-heads" className="font-medium text-brand-600 hover:underline">
            Fee Heads
          </Link>
          , then set up{' '}
          <Link href="/teacher-shares" className="font-medium text-brand-600 hover:underline">
            Teacher Shares
          </Link>
          .
        </div>
      ) : (
        <>
          {data.totalsByTeacher.length > 0 && (
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.totalsByTeacher.map((t: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                <div key={t.teacherId} className="card p-4">
                  <p className="text-sm font-semibold text-slate-800">{t.teacherName}</p>
                  <p className="mt-1 text-xl font-semibold text-emerald-700">{formatCurrency(t.teacherPayoutAmount)}</p>
                  <p className="text-xs text-slate-400">
                    of {formatCurrency(t.nominalShareAmount)} nominal share on {formatCurrency(t.tuitionCollectedInRange)} tuition collected
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="card overflow-x-auto">
            {data.rows.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No tuition share to report for this period.</p>
            ) : (
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Teacher</th>
                    <th>Student</th>
                    <th className="text-right">Tuition Collected</th>
                    <th className="text-right">Share %</th>
                    <th className="text-right">Nominal Share</th>
                    <th className="text-right">Teacher Payout ({data.payoutPercent}%)</th>
                    <th className="text-right">Retained by Institute</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r: any, i: number) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                    <tr key={`${r.shareId}-${r.accountId}-${i}`}>
                      <td className="font-medium text-slate-900">{r.teacherName}</td>
                      <td>{studentDisplayName(r.studentName, r.className)}</td>
                      <td className="text-right">{formatCurrency(r.tuitionCollectedInRange)}</td>
                      <td className="text-right">{r.sharePercentage}%</td>
                      <td className="text-right">{formatCurrency(r.nominalShareAmount)}</td>
                      <td className="text-right font-medium text-emerald-700">{formatCurrency(r.teacherPayoutAmount)}</td>
                      <td className="text-right text-slate-500">{formatCurrency(r.instituteRetainedAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td colSpan={5} className="text-right">
                      Total teacher payout
                    </td>
                    <td className="text-right text-emerald-700">{formatCurrency(data.grandTotalPayout)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
