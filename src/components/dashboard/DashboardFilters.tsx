'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface Option {
  value: string;
  label: string;
}

const FILTER_KEYS = ['academic_year_id', 'class_id', 'course_id', 'branch_id', 'batch_id', 'board_id'] as const;

export function DashboardFilters({
  years,
  courses,
  classes,
  branches,
  batches,
  boards
}: {
  years: Option[];
  courses: Option[];
  classes: Option[];
  branches: Option[];
  batches: Option[];
  boards: Option[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/dashboard?${params.toString()}`);
  }

  const hasFilters = FILTER_KEYS.some((key) => searchParams.get(key));

  return (
    <div className="card flex flex-wrap items-end gap-3 p-4">
      <div>
        <label className="label">Academic Year</label>
        <select
          className="input"
          value={searchParams.get('academic_year_id') ?? ''}
          onChange={(e) => update('academic_year_id', e.target.value)}
        >
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y.value} value={y.value}>
              {y.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Class</label>
        <select className="input" value={searchParams.get('class_id') ?? ''} onChange={(e) => update('class_id', e.target.value)}>
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Course</label>
        <select className="input" value={searchParams.get('course_id') ?? ''} onChange={(e) => update('course_id', e.target.value)}>
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Branch</label>
        <select className="input" value={searchParams.get('branch_id') ?? ''} onChange={(e) => update('branch_id', e.target.value)}>
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Batch</label>
        <select className="input" value={searchParams.get('batch_id') ?? ''} onChange={(e) => update('batch_id', e.target.value)}>
          <option value="">All batches</option>
          {batches.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Board</label>
        <select className="input" value={searchParams.get('board_id') ?? ''} onChange={(e) => update('board_id', e.target.value)}>
          <option value="">All boards</option>
          {boards.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </div>
      {hasFilters && (
        <button type="button" className="btn-secondary" onClick={() => router.push('/dashboard')}>
          Clear filters
        </button>
      )}
    </div>
  );
}
