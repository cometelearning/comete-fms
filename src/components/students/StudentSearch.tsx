'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils/format';

interface StudentRow {
  id: string;
  student_code: string;
  admission_number: string | null;
  name: string;
  guardian_name: string | null;
  student_mobile: string | null;
  parent_mobile: string | null;
  status: string;
  admission_date: string;
}

export function StudentSearch({ canWrite }: { canWrite: boolean }) {
  const [q, setQ] = useState('');
  // Defaults to ACTIVE so inactive/deactivated students are hidden unless
  // explicitly asked for (explicit user request).
  const [status, setStatus] = useState('ACTIVE');
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 25;

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      params.set('status', status);
      params.set('page', String(page));
      fetch(`/api/students?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          setRows(d.data ?? []);
          setCount(d.count ?? 0);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [q, status, page]);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Students</h1>
          <p className="text-sm text-slate-500">Search by name, Student ID, admission number, mobile or email.</p>
        </div>
        {canWrite && (
          <Link href="/students/new" className="btn-primary">
            + Add Student
          </Link>
        )}
      </div>

      <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row">
        <input
          className="input sm:flex-1"
          placeholder="Search students…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="input sm:w-56"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="ACTIVE">Active students</option>
          <option value="INACTIVE">Inactive students</option>
          <option value="ALL">All (incl. Inactive)</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Searching…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No students found.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Name</th>
                <th>Guardian</th>
                <th>Mobile</th>
                <th>Admitted</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className="font-mono text-xs">{s.student_code}</td>
                  <td className="font-medium text-slate-900">{s.name}</td>
                  <td>{s.guardian_name ?? '-'}</td>
                  <td>{s.student_mobile ?? s.parent_mobile ?? '-'}</td>
                  <td>{formatDate(s.admission_date)}</td>
                  <td>
                    <Badge status={s.status} />
                  </td>
                  <td className="text-right">
                    <Link href={`/students/${s.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
    </div>
  );
}
