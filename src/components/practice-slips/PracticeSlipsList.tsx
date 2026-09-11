'use client';

import { useEffect, useState } from 'react';
import { formatDate, studentDisplayName } from '@/lib/utils/format';
import { PracticeSlipDialog } from './PracticeSlipDialog';
import type { FieldOption } from '@/components/masters/MasterCrudPage';

const LEVEL_LABELS: Record<string, string> = {
  LEVEL_1: 'Level 1',
  LEVEL_2: 'Level 2',
  LEVEL_3: 'Level 3',
  NA: 'NA'
};

export function PracticeSlipsList({ subjects, canWrite }: { subjects: FieldOption[]; canWrite: boolean }) {
  const [q, setQ] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [status, setStatus] = useState('');
  // Defaults to ACTIVE so inactive students are hidden unless explicitly
  // asked for, matching every other list/report since the Foundations round.
  const [studentStatus, setStudentStatus] = useState('ACTIVE');
  const [rows, setRows] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<string | null>(null);
  const pageSize = 25;

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (subjectId) params.set('subject_id', subjectId);
    if (status) params.set('status', status);
    params.set('student_status', studentStatus);
    params.set('page', String(page));
    fetch(`/api/practice-slips?${params.toString()}`)
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
  }, [q, subjectId, status, studentStatus, page]);

  async function markChecked(id: string) {
    setChecking(id);
    try {
      await fetch(`/api/practice-slips/${id}/check`, { method: 'POST' });
      load();
    } finally {
      setChecking(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Practice Slips</h1>
          <p className="text-sm text-slate-500">Practice slips allotted to students, by subject and level. Mark each checked once reviewed.</p>
        </div>
        {canWrite && <PracticeSlipDialog mode="create" subjects={subjects} buttonLabel="+ Add Practice Slip" />}
      </div>

      <div className="card mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input
          className="input"
          placeholder="Search student name / Student ID…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select className="input" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setPage(1); }}>
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="CHECKED">Checked</option>
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
          <p className="p-6 text-sm text-slate-500">No practice slips yet.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th>
                <th>Student</th>
                <th>Subject</th>
                <th>Topic</th>
                <th>Level</th>
                <th>Status</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.slip_date)}</td>
                  <td>
                    <p className="font-medium text-slate-900">{studentDisplayName(r.students?.name, r.students?.classes?.name)}</p>
                    <p className="font-mono text-xs text-slate-400">{r.students?.student_code}</p>
                  </td>
                  <td>{r.subjects?.name ?? '-'}</td>
                  <td className="max-w-xs">{r.topic}</td>
                  <td>{LEVEL_LABELS[r.level] ?? r.level}</td>
                  <td>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.status === 'CHECKED' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {r.status === 'CHECKED' ? 'Checked' : 'Pending'}
                    </span>
                  </td>
                  {canWrite && (
                    <td className="whitespace-nowrap text-right">
                      {r.status === 'PENDING' && (
                        <button className="btn-ghost px-2 py-1 text-xs" disabled={checking === r.id} onClick={() => markChecked(r.id)}>
                          {checking === r.id ? 'Marking…' : 'Mark Checked'}
                        </button>
                      )}
                      <PracticeSlipDialog
                        mode="edit"
                        recordId={r.id}
                        studentLabel={r.students?.name}
                        subjects={subjects}
                        initial={{ subject_id: r.subject_id, slip_date: r.slip_date, topic: r.topic, level: r.level }}
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
          Page {page} of {totalPages} ({count} practice slips)
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
