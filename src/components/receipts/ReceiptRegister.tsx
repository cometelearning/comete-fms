'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';

export function ReceiptRegister({ initialStudentId, initialStatus }: { initialStudentId?: string; initialStatus?: string }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(initialStatus ?? '');
  const [mode, setMode] = useState('');
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
      if (mode) params.set('payment_mode', mode);
      if (initialStudentId) params.set('student_id', initialStudentId);
      params.set('page', String(page));
      fetch(`/api/receipts?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          setRows(d.data ?? []);
          setCount(d.count ?? 0);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [q, status, mode, page, initialStudentId]);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Receipts</h1>
        <p className="text-sm text-slate-500">Complete receipt register. Cancelled receipts remain visible and traceable.</p>
      </div>

      <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row">
        <input className="input sm:flex-1" placeholder="Search by receipt number…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className="input sm:w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select className="input sm:w-44" value={mode} onChange={(e) => { setMode(e.target.value); setPage(1); }}>
          <option value="">All payment modes</option>
          {['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER'].map((m) => (
            <option key={m} value={m}>
              {m.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No receipts found.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Receipt No.</th>
                <th>Date</th>
                <th>Student</th>
                <th>Course</th>
                <th className="text-right">Amount</th>
                <th>Mode</th>
                <th>Created By</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.status === 'CANCELLED' ? 'opacity-60' : ''}>
                  <td className="font-mono text-xs">{r.receipt_number}</td>
                  <td>{formatDateTime(r.issued_at)}</td>
                  <td>
                    {r.payments?.students?.name}
                    <p className="font-mono text-xs text-slate-400">{r.payments?.students?.student_code}</p>
                  </td>
                  <td>{r.payments?.students?.courses?.name ?? '-'}</td>
                  <td className="text-right">{formatCurrency(r.payments?.amount)}</td>
                  <td>{r.payments?.payment_mode?.replace('_', ' ')}</td>
                  <td>{r.profiles?.full_name ?? '-'}</td>
                  <td>
                    <Badge status={r.status} />
                  </td>
                  <td className="text-right">
                    <Link href={`/receipts/${r.id}`} className="text-sm font-medium text-brand-600 hover:underline">
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
            Page {page} of {totalPages} ({count} receipts)
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
