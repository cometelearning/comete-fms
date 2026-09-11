'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/utils/format';
import type { FieldOption } from '@/components/masters/MasterCrudPage';

export function StudentRecordReport({
  years,
  courses,
  classes,
  branches,
  batches,
  boards,
  canExport
}: {
  years: FieldOption[];
  courses: FieldOption[];
  classes: FieldOption[];
  branches: FieldOption[];
  batches: FieldOption[];
  boards: FieldOption[];
  canExport: boolean;
}) {
  const [q, setQ] = useState('');
  const [yearId, setYearId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [classId, setClassId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [boardId, setBoardId] = useState('');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 30;

  function buildParams() {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (yearId) params.set('academic_year_id', yearId);
    if (courseId) params.set('course_id', courseId);
    if (classId) params.set('class_id', classId);
    if (branchId) params.set('branch_id', branchId);
    if (batchId) params.set('batch_id', batchId);
    if (boardId) params.set('board_id', boardId);
    if (status) params.set('status', status);
    return params;
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      const params = buildParams();
      params.set('page', String(page));
      fetch(`/api/reports/students?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          setRows(d.data ?? []);
          setCount(d.count ?? 0);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, yearId, courseId, classId, branchId, batchId, boardId, status, page]);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  function exportAs(format: string) {
    const params = buildParams();
    params.set('format', format);
    window.open(`/api/reports/students/export?${params.toString()}`, '_blank');
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Student Record</h1>
          <p className="text-sm text-slate-500">
            Every student, filterable by academic year, class, course, branch, batch, board and status, with a live fee summary.
          </p>
        </div>
        {canExport && (
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => exportAs('csv')}>CSV</button>
            <button className="btn-secondary" onClick={() => exportAs('xlsx')}>Excel</button>
            <button className="btn-secondary" onClick={() => exportAs('pdf')}>PDF</button>
          </div>
        )}
      </div>

      <div className="card mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input
          className="input"
          placeholder="Search name / Student ID…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
        />
        <select className="input" value={yearId} onChange={(e) => { setYearId(e.target.value); setPage(1); }}>
          <option value="">All academic years</option>
          {years.map((y) => (
            <option key={y.value} value={y.value}>{y.label}</option>
          ))}
        </select>
        <select className="input" value={classId} onChange={(e) => { setClassId(e.target.value); setPage(1); }}>
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select className="input" value={courseId} onChange={(e) => { setCourseId(e.target.value); setPage(1); }}>
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select className="input" value={branchId} onChange={(e) => { setBranchId(e.target.value); setPage(1); }}>
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>
        <select className="input" value={batchId} onChange={(e) => { setBatchId(e.target.value); setPage(1); }}>
          <option value="">All batches</option>
          {batches.map((b) => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>
        <select className="input" value={boardId} onChange={(e) => { setBoardId(e.target.value); setPage(1); }}>
          <option value="">All boards</option>
          {boards.map((b) => (
            <option key={b.value} value={b.value}>{b.label}</option>
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
          <p className="p-6 text-sm text-slate-500">No students match the selected filters.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Student</th>
                <th>Mobile</th>
                <th>Course</th>
                <th>Class</th>
                <th>Academic Year</th>
                <th>Branch</th>
                <th className="text-right">Total Fee</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Outstanding</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <p className="font-medium text-slate-900">{r.name}</p>
                    <p className="font-mono text-xs text-slate-400">{r.student_code}</p>
                  </td>
                  <td>{r.student_mobile ?? r.parent_mobile ?? '-'}</td>
                  <td>{r.courses?.name ?? '-'}</td>
                  <td>{r.courses?.class_standard ?? '-'}</td>
                  <td>{r.academic_years?.name ?? '-'}</td>
                  <td>{r.branches?.name ?? '-'}</td>
                  <td className="text-right">{formatCurrency(r.fee_totals?.totalFee ?? 0)}</td>
                  <td className="text-right text-emerald-700">{formatCurrency(r.fee_totals?.paidTotal ?? 0)}</td>
                  <td className="text-right text-red-700">{formatCurrency(r.fee_totals?.outstandingTotal ?? 0)}</td>
                  <td>
                    <Badge status={r.status} />
                  </td>
                  <td className="text-right">
                    <Link href={`/students/${r.id}`} className="text-sm font-medium text-brand-600 hover:underline">
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
          <span>Page {page} of {totalPages} ({count} students)</span>
          <div className="flex gap-2">
            <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
