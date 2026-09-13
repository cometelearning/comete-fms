'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { formatDate, studentDisplayName } from '@/lib/utils/format';
import { TeacherShareDialog } from './TeacherShareDialog';
import type { FieldOption } from '@/components/masters/MasterCrudPage';

export function TeacherSharesList({ teachers }: { teachers: FieldOption[] }) {
  const [q, setQ] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 25;

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (teacherId) params.set('teacher_id', teacherId);
    if (status) params.set('status', status);
    params.set('page', String(page));
    fetch(`/api/teacher-shares?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.data ?? []);
        setCount(d.count ?? 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const handle = setTimeout(load, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, teacherId, status, page]);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Teacher Shares</h1>
          <p className="text-sm text-slate-500">
            Which teachers hold a % share of the Tuition Fee portion of specific students&apos; collections. Admission, Study Material and
            Examination Fee are always excluded.
          </p>
        </div>
        <TeacherShareDialog mode="create" teachers={teachers} buttonLabel="+ Add Teacher Share" />
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
        <select className="input" value={teacherId} onChange={(e) => { setTeacherId(e.target.value); setPage(1); }}>
          <option value="">All teachers</option>
          {teachers.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No teacher shares set up yet.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Student</th>
                <th className="text-right">Share %</th>
                <th>Effective From</th>
                <th>Effective To</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium text-slate-900">{r.teachers?.name ?? '-'}</td>
                  <td>
                    <p className="font-medium text-slate-900">{studentDisplayName(r.students?.name, r.students?.classes?.name)}</p>
                    <p className="font-mono text-xs text-slate-400">{r.students?.student_code}</p>
                  </td>
                  <td className="text-right">{r.share_percentage}%</td>
                  <td>{formatDate(r.effective_from)}</td>
                  <td>{r.effective_to ? formatDate(r.effective_to) : 'Ongoing'}</td>
                  <td>
                    <Badge status={r.status} />
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <TeacherShareDialog
                      mode="edit"
                      recordId={r.id}
                      studentLabel={r.students?.name}
                      teachers={teachers}
                      initial={{
                        teacher_id: r.teacher_id,
                        share_percentage: r.share_percentage,
                        effective_from: r.effective_from,
                        effective_to: r.effective_to
                      }}
                      buttonLabel="Edit"
                      buttonClassName="btn-ghost px-2 py-1 text-xs"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
        <span>
          Page {page} of {totalPages} ({count} teacher shares)
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
    </div>
  );
}
