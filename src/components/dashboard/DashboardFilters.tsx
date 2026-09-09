'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface Option {
  value: string;
  label: string;
}

export function DashboardFilters({
  years,
  courses,
  classes
}: {
  years: Option[];
  courses: Option[];
  classes: Option[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/dashboard?${params.toString()}`);
  }

  const hasFilters = searchParams.get('academic_year_id') || searchParams.get('course_id') || searchParams.get('class_standard');

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
        <label className="label">Class / Standard</label>
        <select
          className="input"
          value={searchParams.get('class_standard') ?? ''}
          onChange={(e) => update('class_standard', e.target.value)}
        >
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
        <select
          className="input"
          value={searchParams.get('course_id') ?? ''}
          onChange={(e) => update('course_id', e.target.value)}
        >
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
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
