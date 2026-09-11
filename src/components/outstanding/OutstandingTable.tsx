'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import type { FieldOption } from '@/components/masters/MasterCrudPage';

interface Props {
  years: FieldOption[];
  courses: FieldOption[];
  classes: FieldOption[];
  canExport: boolean;
}

export function OutstandingTable({ years, courses, classes, canExport }: Props) {
  const [q, setQ] = useState('');
  const [yearId, setYearId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [classId, setClassId] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [rows, setRows] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 25;

  function buildParams() {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (yearId) params.set('academic_year_id', yearId);
    if (courseId) params.set('course_id', courseId);
    if (classId) params.set('class_id', classId);
    if (overdueOnly) params.set('overdue_only', 'true');
    return params;
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      const params = buildParams();
      params.set('page', String(page));
      fetch(`/api/outstanding?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          setRows(d.data ?? []);
          setCount(d.count ?? 0);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, yearId, courseId, classId, overdueOnly, page]);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const totalOutstanding = rows.reduce((sum, r) => sum + Number(r.outstanding_total), 0);

  function exportAs(format: string) {
    const params = buildParams();
    params.set('format', format);
    window.open(`/api/outstanding/export?${params.toString()}`, '_blank');
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Outstanding Fees</h1>
          <p className="text-sm text-slate-500">Students with a pending balance, across all fee accounts.</p>
        </div>
        {canExport && (
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => exportAs('csv')}>
              Export CSV
            </button>
            <button className="btn-secondary" onClick={() => exportAs('xlsx')}>
              Export Excel
            </button>
            <button className="btn-secondary" onClick={() => exportAs('pdf')}>
              Export PDF
            </button>
          </div>
        )}
      </div>

      <div className="card mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <input className="input" placeholder="Search student…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className="input" value={yearId} onChange={(e) => { setYearId(e.target.value); setPage(1); }}>
          <option value="">All academic years</option>
          {years.map((y) => (
            <option key={y.value} value={y.value}>
              {y.label}
            </option>
          ))}
        </select>
        <select className="input" value={courseId} onChange={(e) => { setCourseId(e.target.value); setPage(1); }}>
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select className="input" value={classId} onChange={(e) => { setClassId(e.target.value); setPage(1); }}>
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={overdueOnly} onChange={(e) => { setOverdueOnly(e.target.checked); setPage(1); }} />
          Overdue only
        </label>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No students with outstanding fees found.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Student</th>
                <th>Mobile</th>
                <th>Course</th>
                <th>Class</th>
                <th className="text-right">Total</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Outstanding</th>
                <th className="text-right">Overdue</th>
                <th>Next Due</th>
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
                  <td>{r.students?.student_mobile ?? r.students?.parent_mobile ?? '-'}</td>
                  <td>{r.students?.courses?.name ?? '-'}</td>
                  <td>{r.students?.courses?.class_standard ?? '-'}</td>
                  <td className="text-right">{formatCurrency(r.total_fee)}</td>
                  <td className="text-right text-emerald-700">{formatCurrency(r.paid_total)}</td>
                  <td className="text-right font-semibold text-red-700">{formatCurrency(r.outstanding_total)}</td>
                  <td className="text-right">{formatCurrency(r.overdue_amount)}</td>
                  <td>{r.next_due_date ? formatDate(r.next_due_date) : '-'}</td>
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
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={6}>Total (this page)</td>
                <td className="text-right text-red-700">{formatCurrency(totalOutstanding)}</td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>
            Page {page} of {totalPages} ({count} students)
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
