'use client';

import { useEffect, useState } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import type { FieldOption } from '@/components/masters/MasterCrudPage';

const PAYMENT_MODES = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER'];

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export function CollectionReport({
  courses,
  classes,
  users,
  canExport
}: {
  courses: FieldOption[];
  classes: FieldOption[];
  users: FieldOption[];
  canExport: boolean;
}) {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [courseId, setCourseId] = useState('');
  const [classId, setClassId] = useState('');
  const [mode, setMode] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  // Defaults to ACTIVE so inactive students are hidden unless explicitly
  // asked for (explicit user request).
  const [studentStatus, setStudentStatus] = useState('ACTIVE');
  const [rows, setRows] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 30;

  function buildParams() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (courseId) params.set('course_id', courseId);
    if (classId) params.set('class_id', classId);
    if (mode) params.set('payment_mode', mode);
    if (createdBy) params.set('created_by', createdBy);
    params.set('student_status', studentStatus);
    return params;
  }

  useEffect(() => {
    setLoading(true);
    const params = buildParams();
    params.set('page', String(page));
    fetch(`/api/reports/collection?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.data ?? []);
        setCount(d.count ?? 0);
        setTotal(d.total ?? 0);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, courseId, classId, mode, createdBy, studentStatus, page]);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  function exportAs(format: string) {
    const params = buildParams();
    params.set('format', format);
    window.open(`/api/reports/collection/export?${params.toString()}`, '_blank');
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Collection Report</h1>
          <p className="text-sm text-slate-500">Filter by date, class, course, payment mode or user to see daily, class-wise, course-wise or user-wise collections.</p>
        </div>
        {canExport && (
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => exportAs('csv')}>CSV</button>
            <button className="btn-secondary" onClick={() => exportAs('xlsx')}>Excel</button>
            <button className="btn-secondary" onClick={() => exportAs('pdf')}>PDF</button>
          </div>
        )}
      </div>

      <div className="card mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
        <div>
          <label className="label">Class / Standard</label>
          <select className="input" value={classId} onChange={(e) => { setClassId(e.target.value); setPage(1); }}>
            <option value="">All</option>
            {classes.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Course</label>
          <select className="input" value={courseId} onChange={(e) => { setCourseId(e.target.value); setPage(1); }}>
            <option value="">All</option>
            {courses.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Payment Mode</label>
          <select className="input" value={mode} onChange={(e) => { setMode(e.target.value); setPage(1); }}>
            <option value="">All</option>
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>{m.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Collected By</label>
          <select className="input" value={createdBy} onChange={(e) => { setCreatedBy(e.target.value); setPage(1); }}>
            <option value="">All</option>
            {users.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Student Status</label>
          <select className="input" value={studentStatus} onChange={(e) => { setStudentStatus(e.target.value); setPage(1); }}>
            <option value="ACTIVE">Active students</option>
            <option value="INACTIVE">Inactive students</option>
            <option value="ALL">All (incl. Inactive)</option>
          </select>
        </div>
      </div>

      <div className="card mb-4 p-4">
        <p className="text-sm text-slate-500">Total collection for selected filters</p>
        <p className="text-2xl font-bold text-emerald-700">{formatCurrency(total)}</p>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No collections for the selected filters.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th>
                <th>Receipt No.</th>
                <th>Student</th>
                <th>Course</th>
                <th>Class</th>
                <th className="text-right">Amount</th>
                <th>Mode</th>
                <th>Collected By</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.payment_date)}</td>
                  <td className="font-mono text-xs">{r.receipts?.receipt_number ?? r.receipts?.[0]?.receipt_number ?? '-'}</td>
                  <td>{r.students?.name}</td>
                  <td>{r.students?.courses?.name ?? '-'}</td>
                  <td>{r.students?.classes?.name ?? '-'}</td>
                  <td className="text-right">{formatCurrency(r.amount)}</td>
                  <td>{r.payment_mode?.replace('_', ' ')}</td>
                  <td>{r.profiles?.full_name ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
        <span>Page {page} of {totalPages} ({count} transactions)</span>
        <div className="flex gap-2">
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}
