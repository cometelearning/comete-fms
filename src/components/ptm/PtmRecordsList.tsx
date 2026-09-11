'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils/format';
import { PtmRecordDialog } from './PtmRecordDialog';

export function PtmRecordsList({ canWrite }: { canWrite: boolean }) {
  const [q, setQ] = useState('');
  const [attended, setAttended] = useState('');
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
      if (attended) params.set('attended', attended);
      params.set('page', String(page));
      fetch(`/api/ptm-records?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          setRows(d.data ?? []);
          setCount(d.count ?? 0);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [q, attended, page]);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">PTM Records</h1>
          <p className="text-sm text-slate-500">Parent-Teacher Meeting attendance and remarks, per student.</p>
        </div>
        {canWrite && <PtmRecordDialog mode="create" buttonLabel="+ Add PTM Record" />}
      </div>

      <div className="card mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
        <input
          className="input"
          placeholder="Search student name / Student ID…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="input"
          value={attended}
          onChange={(e) => {
            setAttended(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All</option>
          <option value="true">Attended</option>
          <option value="false">Not Attended</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No PTM records yet.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Student</th>
                <th>Date of PTM</th>
                <th>Attended</th>
                <th>Parent&apos;s Remarks</th>
                <th>Counsellor Remarks</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <p className="font-medium text-slate-900">{r.students?.name}</p>
                    <p className="font-mono text-xs text-slate-400">{r.students?.student_code}</p>
                  </td>
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
                  <td className="max-w-xs truncate">{r.parent_remarks ?? '-'}</td>
                  <td className="max-w-xs truncate">{r.counsellor_remarks ?? '-'}</td>
                  {canWrite && (
                    <td className="whitespace-nowrap text-right">
                      <PtmRecordDialog
                        mode="edit"
                        recordId={r.id}
                        studentLabel={r.students?.name}
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
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>
            Page {page} of {totalPages} ({count} records)
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
