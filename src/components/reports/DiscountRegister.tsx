'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/utils/format';

export function DiscountRegister({ canReverse }: { canReverse: boolean }) {
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reversing, setReversing] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const pageSize = 30;

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('page', String(page));
    fetch(`/api/reports/discounts?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.data ?? []);
        setCount(d.count ?? 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [status, page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmReverse(id: string) {
    if (!reason.trim()) return;
    await fetch(`/api/discounts/${id}/reverse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    setReversing(null);
    setReason('');
    load();
  }

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Discount Register</h1>
        <p className="text-sm text-slate-500">Every discount, concession and waiver granted, with who granted it and why.</p>
      </div>

      <div className="card mb-4 p-4">
        <select className="input sm:w-56" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="REVERSED">Reversed</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No discounts recorded.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th>
                <th>Student</th>
                <th>Type</th>
                <th className="text-right">Amount</th>
                <th>Reason</th>
                <th>Granted By</th>
                <th>Status</th>
                {canReverse && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td>{formatDate(d.created_at)}</td>
                  <td>{d.student_fee_accounts?.students?.name}</td>
                  <td>{d.discount_type === 'PERCENTAGE' ? `${d.value}%` : 'Fixed'}</td>
                  <td className="text-right">{formatCurrency(d.amount)}</td>
                  <td>{d.reason}</td>
                  <td>{d.profiles?.full_name ?? '-'}</td>
                  <td>
                    <Badge status={d.status} />
                  </td>
                  {canReverse && (
                    <td className="text-right">
                      {d.status === 'ACTIVE' &&
                        (reversing === d.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              className="input w-40 py-1 text-xs"
                              placeholder="Reason for reversal"
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                            />
                            <button className="btn-danger px-2 py-1 text-xs" onClick={() => confirmReverse(d.id)}>
                              Confirm
                            </button>
                            <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setReversing(null)}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button className="btn-ghost px-2 py-1 text-xs text-red-600" onClick={() => setReversing(d.id)}>
                            Reverse
                          </button>
                        ))}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
