'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/utils/format';

export function StudentFeesList() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 25;

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      params.set('page', String(page));
      fetch(`/api/student-fees?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          setRows(d.data ?? []);
          setCount(d.count ?? 0);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [q, status, page]);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Student Fees</h1>
        <p className="text-sm text-slate-500">Every fee account across all students, with live totals.</p>
      </div>

      <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row">
        <input
          className="input sm:flex-1"
          placeholder="Search by student name or Student ID…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="input sm:w-56"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="FULLY_PAID">Fully Paid</option>
          <option value="OVERDUE">Overdue</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="PENDING">Pending</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No fee accounts found.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Student</th>
                <th>Fee Structure</th>
                <th>Academic Year</th>
                <th className="text-right">Total</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Outstanding</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.student_fee_account_id}>
                  <td>
                    <p className="font-medium text-slate-900">{r.students?.name}</p>
                    <p className="font-mono text-xs text-slate-400">{r.students?.student_code}</p>
                  </td>
                  <td>{r.fee_structures?.name}</td>
                  <td>{r.academic_years?.name}</td>
                  <td className="text-right">{formatCurrency(r.total_fee)}</td>
                  <td className="text-right text-emerald-700">{formatCurrency(r.paid_total)}</td>
                  <td className="text-right text-red-700">{formatCurrency(r.outstanding_total)}</td>
                  <td>
                    <Badge status={r.overall_status} />
                  </td>
                  <td className="text-right">
                    <Link href={`/students/${r.student_id}`} className="text-sm font-medium text-brand-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>
            Page {page} of {totalPages} ({count} accounts)
          </span>
          <div className="flex gap-2">
            <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
