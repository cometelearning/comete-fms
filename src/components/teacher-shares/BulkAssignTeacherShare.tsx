'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { studentDisplayName } from '@/lib/utils/format';
import type { FieldOption } from '@/components/masters/MasterCrudPage';

interface StudentRow {
  id: string;
  student_code: string;
  name: string;
  class_id: string | null;
  classes: { name: string } | null;
}

const todayStr = () => new Date().toISOString().slice(0, 10);
const PAGE_SIZE = 25;

/**
 * Bulk version of TeacherShareDialog (spec: "There should be an option to
 * allocate multiple students to a teacher... filter screen so that students
 * of a particular course can be directly allotted"). Two independent things
 * are tracked: the FILTER (which narrows the student list shown/searched)
 * and the SELECTION (which of those students the assignment actually
 * applies to) - "Select all N matching" switches the selection to follow the
 * filter itself (resolved server-side, so it is correct even beyond the
 * current page) rather than a fixed checked-ID set.
 */
export function BulkAssignTeacherShare({
  teachers,
  courses,
  classes,
  batches,
  academicYears
}: {
  teachers: FieldOption[];
  courses: FieldOption[];
  classes: FieldOption[];
  batches: FieldOption[];
  academicYears: FieldOption[];
}) {
  const [q, setQ] = useState('');
  const [courseId, setCourseId] = useState('');
  const [classId, setClassId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');

  const [rows, setRows] = useState<StudentRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);

  const [teacherId, setTeacherId] = useState('');
  const [sharePercentage, setSharePercentage] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(todayStr());
  const [effectiveTo, setEffectiveTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const filters = { q, course_id: courseId, class_id: classId, batch_id: batchId, academic_year_id: academicYearId };

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (courseId) params.set('course_id', courseId);
    if (classId) params.set('class_id', classId);
    if (batchId) params.set('batch_id', batchId);
    if (academicYearId) params.set('academic_year_id', academicYearId);
    params.set('page', String(page));
    fetch(`/api/students?${params.toString()}`)
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
  }, [q, courseId, classId, batchId, academicYearId, page]);

  // Any filter change invalidates a previous "select all matching" and the
  // explicit checked set - the set of matching students has changed.
  function updateFilter(setter: (v: string) => void, value: string) {
    setter(value);
    setPage(1);
    setSelectAllMatching(false);
    setChecked(new Set());
    setResult(null);
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const selectionCount = selectAllMatching ? count : checked.size;

  function toggleRow(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (selectionCount === 0) {
      setError('Select at least one student.');
      return;
    }
    if (!teacherId) {
      setError('Select a teacher.');
      return;
    }
    const pct = Number(sharePercentage);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      setError('Enter a share percentage between 0 and 100.');
      return;
    }
    setSaving(true);
    try {
      const selection = selectAllMatching
        ? { mode: 'filter' as const, filters }
        : { mode: 'ids' as const, student_ids: Array.from(checked) };
      const res = await fetch('/api/teacher-shares/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: teacherId,
          share_percentage: pct,
          effective_from: effectiveFrom,
          effective_to: effectiveTo || undefined,
          selection
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not save these teacher shares.');
        return;
      }
      setResult(`Created ${data.data.created} teacher share${data.data.created === 1 ? '' : 's'}.`);
      setChecked(new Set());
      setSelectAllMatching(false);
      setTeacherId('');
      setSharePercentage('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Bulk Assign Teacher Share</h1>
          <p className="text-sm text-slate-500">Filter students - by course, class, batch or academic year - and assign one teacher share to all of them at once.</p>
        </div>
        <Link href="/teacher-shares" className="btn-secondary">
          Back to Teacher Shares
        </Link>
      </div>

      <div className="card mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <input className="input lg:col-span-2" placeholder="Search student name / Student ID…" value={q} onChange={(e) => updateFilter(setQ, e.target.value)} />
        <select className="input" value={academicYearId} onChange={(e) => updateFilter(setAcademicYearId, e.target.value)}>
          <option value="">All academic years</option>
          {academicYears.map((y) => (
            <option key={y.value} value={y.value}>{y.label}</option>
          ))}
        </select>
        <select className="input" value={courseId} onChange={(e) => updateFilter(setCourseId, e.target.value)}>
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select className="input" value={classId} onChange={(e) => updateFilter(setClassId, e.target.value)}>
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select className="input" value={batchId} onChange={(e) => updateFilter(setBatchId, e.target.value)}>
          <option value="">All batches</option>
          {batches.map((b) => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>
      </div>

      {count > PAGE_SIZE && !selectAllMatching && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-brand-200 bg-brand-50 px-4 py-2 text-sm text-brand-800">
          <span>{checked.size} selected on this page. This filter matches {count} students in total.</span>
          <button type="button" className="font-medium underline" onClick={() => setSelectAllMatching(true)}>
            Select all {count} matching students
          </button>
        </div>
      )}
      {selectAllMatching && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-brand-200 bg-brand-50 px-4 py-2 text-sm text-brand-800">
          <span>All {count} students matching this filter are selected.</span>
          <button
            type="button"
            className="font-medium underline"
            onClick={() => {
              setSelectAllMatching(false);
              setChecked(new Set());
            }}
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="card mb-6 overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No students match this filter.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th className="w-10"></th>
                <th>Student</th>
                <th>Student ID</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectAllMatching || checked.has(s.id)}
                      disabled={selectAllMatching}
                      onChange={() => toggleRow(s.id)}
                    />
                  </td>
                  <td className="font-medium text-slate-900">{studentDisplayName(s.name, s.classes?.name)}</td>
                  <td className="font-mono text-xs text-slate-400">{s.student_code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="mb-6 flex items-center justify-between text-sm text-slate-600">
        <span>
          Page {page} of {totalPages} ({count} students match this filter)
        </span>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <button type="button" className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>

      <form onSubmit={submit} className="card space-y-4 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Assign to {selectionCount || 0} selected student{selectionCount === 1 ? '' : 's'}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Teacher *</label>
            <select className="input" required value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">Select…</option>
              {teachers.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Share % of Tuition Fee *</label>
            <input
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              className="input"
              required
              value={sharePercentage}
              onChange={(e) => setSharePercentage(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Effective From *</label>
            <input type="date" className="input" required value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">Effective To</label>
            <input type="date" className="input" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
            <p className="mt-1 text-xs text-slate-400">Leave blank if still ongoing.</p>
          </div>
        </div>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {result && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{result}</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={saving || selectionCount === 0} className="btn-primary">
            {saving ? 'Saving…' : `Assign to ${selectionCount || 0} student${selectionCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </form>
    </div>
  );
}
