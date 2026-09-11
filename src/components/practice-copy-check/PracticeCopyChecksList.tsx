'use client';

import { useEffect, useState } from 'react';
import { formatDate, studentDisplayName } from '@/lib/utils/format';
import { PracticeCopyCheckDialog } from './PracticeCopyCheckDialog';
import type { FieldOption } from '@/components/masters/MasterCrudPage';

export function PracticeCopyChecksList({ teachers, canWrite }: { teachers: FieldOption[]; canWrite: boolean }) {
  const [q, setQ] = useState('');
  const [teacherId, setTeacherId] = useState('');
  // Defaults to ACTIVE so inactive students are hidden unless explicitly
  // asked for, matching every other list/report since the Foundations round.
  const [studentStatus, setStudentStatus] = useState('ACTIVE');
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
    params.set('student_status', studentStatus);
    params.set('page', String(page));
    fetch(`/api/practice-copy-checks?${params.toString()}`)
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
  }, [q, teacherId, studentStatus, page]);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Practice Copy Check</h1>
          <p className="text-sm text-slate-500">Record of when a student&apos;s practice copy was checked, and by which teacher.</p>
        </div>
        {canWrite && <PracticeCopyCheckDialog mode="create" teachers={teachers} buttonLabel="+ Add Practice Copy Check" />}
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
        <select className="input" value={studentStatus} onChange={(e) => { setStudentStatus(e.target.value); setPage(1); }}>
          <option value="ACTIVE">Active students</option>
          <option value="INACTIVE">Inactive students</option>
          <option value="ALL">All (incl. Inactive)</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No practice copy checks yet.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Date Checked</th>
                <th>Student</th>
                <th>Teacher (Signed)</th>
                <th>Remarks</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.check_date)}</td>
                  <td>
                    <p className="font-medium text-slate-900">{studentDisplayName(r.students?.name, r.students?.classes?.name)}</p>
                    <p className="font-mono text-xs text-slate-400">{r.students?.student_code}</p>
                  </td>
                  <td>{r.teachers?.name ?? '-'}</td>
                  <td className="max-w-xs">{r.remarks ?? '-'}</td>
                  {canWrite && (
                    <td className="whitespace-nowrap text-right">
                      <PracticeCopyCheckDialog
                        mode="edit"
                        recordId={r.id}
                        studentLabel={r.students?.name}
                        teachers={teachers}
                        initial={{ check_date: r.check_date, teacher_id: r.teacher_id, remarks: r.remarks }}
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

      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
        <span>
          Page {page} of {totalPages} ({count} practice copy checks)
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
