'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FieldOption } from '@/components/masters/MasterCrudPage';

interface Props {
  mode: 'create' | 'edit';
  studentId?: string;
  courses: FieldOption[];
  years: FieldOption[];
  initial?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const emptyForm = {
  admission_number: '',
  name: '',
  guardian_name: '',
  student_mobile: '',
  parent_mobile: '',
  student_email: '',
  parent_email: '',
  address: '',
  course_id: '',
  academic_year_id: '',
  admission_date: new Date().toISOString().slice(0, 10),
  remarks: ''
};

export function StudentForm({ mode, studentId, courses, years, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, any>>({ ...emptyForm, ...initial }); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const url = mode === 'create' ? '/api/students' : `/api/students/${studentId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not save this student.');
        return;
      }
      router.push(`/students/${data.data.id}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-6 p-6">
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-slate-800">Student details</legend>
        <div>
          <label className="label">Student Name *</label>
          <input className="input" required value={form.name} onChange={(e) => update('name', e.target.value)} />
        </div>
        <div>
          <label className="label">Admission Number</label>
          <input className="input" value={form.admission_number} onChange={(e) => update('admission_number', e.target.value)} />
        </div>
        <div>
          <label className="label">Parent / Guardian Name</label>
          <input className="input" value={form.guardian_name} onChange={(e) => update('guardian_name', e.target.value)} />
        </div>
        <div>
          <label className="label">Admission Date</label>
          <input type="date" className="input" value={form.admission_date} onChange={(e) => update('admission_date', e.target.value)} />
        </div>
        <div>
          <label className="label">Student Mobile</label>
          <input className="input" value={form.student_mobile} onChange={(e) => update('student_mobile', e.target.value)} />
        </div>
        <div>
          <label className="label">Parent Mobile</label>
          <input className="input" value={form.parent_mobile} onChange={(e) => update('parent_mobile', e.target.value)} />
        </div>
        <div>
          <label className="label">Student Email</label>
          <input type="email" className="input" value={form.student_email} onChange={(e) => update('student_email', e.target.value)} />
        </div>
        <div>
          <label className="label">Parent Email</label>
          <input type="email" className="input" value={form.parent_email} onChange={(e) => update('parent_email', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Address</label>
          <textarea className="input" value={form.address} onChange={(e) => update('address', e.target.value)} />
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-slate-800">Academic placement</legend>
        <div>
          <label className="label">Academic Year</label>
          <select className="input" value={form.academic_year_id} onChange={(e) => update('academic_year_id', e.target.value)}>
            <option value="">Select…</option>
            {years.map((y) => (
              <option key={y.value} value={y.value}>
                {y.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Course / Class</label>
          <select className="input" value={form.course_id} onChange={(e) => update('course_id', e.target.value)}>
            <option value="">Select…</option>
            {courses.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <div>
        <label className="label">Remarks</label>
        <textarea className="input" value={form.remarks} onChange={(e) => update('remarks', e.target.value)} />
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={() => router.back()}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : mode === 'create' ? 'Create Student' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
