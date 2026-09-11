'use client';

import { Fragment, useEffect, useState } from 'react';
import { formatDateTime } from '@/lib/utils/format';

const MODULES = ['students', 'academic_years', 'classes', 'courses', 'batches', 'fee_heads', 'fee_structures', 'student_fees', 'payments', 'receipts', 'discounts', 'users'];

export function AuditTrail() {
  const [module_, setModule] = useState('');
  const [rows, setRows] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const pageSize = 40;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (module_) params.set('module', module_);
    params.set('page', String(page));
    fetch(`/api/audit-logs?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.data ?? []);
        setCount(d.count ?? 0);
      })
      .finally(() => setLoading(false));
  }, [module_, page]);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Audit Trail</h1>
        <p className="text-sm text-slate-500">Every important action, who did it, and when. Nothing here can be edited or deleted.</p>
      </div>

      <div className="card mb-4 p-4">
        <select className="input sm:w-64" value={module_} onChange={(e) => { setModule(e.target.value); setPage(1); }}>
          <option value="">All modules</option>
          {MODULES.map((m) => (
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
          <p className="p-6 text-sm text-slate-500">No audit entries found.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Action</th>
                <th>Module</th>
                <th>Reason</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.id}>
                  <tr>
                    <td className="whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                    <td>{r.user_email ?? 'System'}</td>
                    <td className="font-medium">{r.action.replace(/_/g, ' ')}</td>
                    <td>{r.module.replace(/_/g, ' ')}</td>
                    <td>{r.reason ?? '-'}</td>
                    <td>
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                        {expanded === r.id ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>
                  {expanded === r.id && (
                    <tr>
                      <td colSpan={6} className="bg-slate-50">
                        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
                          <div>
                            <p className="mb-1 text-xs font-semibold text-slate-500">Previous value</p>
                            <pre className="max-h-40 overflow-auto rounded bg-white p-2 text-xs">{JSON.stringify(r.previous_value, null, 2) ?? '-'}</pre>
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-semibold text-slate-500">New value</p>
                            <pre className="max-h-40 overflow-auto rounded bg-white p-2 text-xs">{JSON.stringify(r.new_value, null, 2) ?? '-'}</pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>
            Page {page} of {totalPages}
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
