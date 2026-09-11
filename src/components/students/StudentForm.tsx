'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FieldOption } from '@/components/masters/MasterCrudPage';
import { FeeEntry, type FeeEntryState, type FeeHeadOption } from '@/components/fee/FeeEntry';

interface Props {
  mode: 'create' | 'edit';
  studentId?: string;
  courses: FieldOption[];
  years: FieldOption[];
  branches: FieldOption[];
  batches: FieldOption[];
  boards: FieldOption[];
  feeHeads?: FeeHeadOption[];
  initial?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const emptyForm = {
  admission_number: '',
  name: '',
  guardian_name: '',
  date_of_birth: '',
  student_mobile: '',
  parent_mobile: '',
  student_email: '',
  parent_email: '',
  address: '',
  course_id: '',
  academic_year_id: '',
  branch_id: '',
  batch_id: '',
  board_id: '',
  school_name: '',
  last_year_percentage: '',
  admission_date: new Date().toISOString().slice(0, 10),
  remarks: '',
  parent_remarks: ''
};

// Every field on this form is mandatory (per the office's data-entry policy)
// except Student Mobile, Student Email and Parent Email (not every student
// has their own phone/email, and some parents have no email - Parent
// Mobile stays mandatory since there must always be a way to reach a
// guardian), and the Fee section below, which stays optional and can always
// be filled in later from the student's profile. Being mandatory only
// governs what's needed to save; every field, including these, stays
// editable afterwards from this same form in edit mode.
export function StudentForm({ mode, studentId, courses, years, branches, batches, boards, feeHeads, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, any>>({ ...emptyForm, ...initial }); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [feeState, setFeeState] = useState<FeeEntryState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdStudentId, setCreatedStudentId] = useState<string | null>(null);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function feeIsIncomplete() {
    if (!feeState || !feeState.hasAnyInput) return false;
    const itemsValid = feeState.items.every((i) => i.fee_head_id && Number(i.amount) > 0);
    return !itemsValid || feeState.installments.length === 0 || !feeState.balanced;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate the fee section (if the office started filling it in) BEFORE
    // creating the student, so an incomplete fee never leaves an orphaned
    // "half saved" profile behind.
    if (mode === 'create' && feeIsIncomplete()) {
      setError('The fee section is incomplete - every fee head needs an amount, and the installments must add up to the total fee.');
      return;
    }

    setSaving(true);
    try {
      const url = mode === 'create' ? '/api/students' : `/api/students/${studentId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not save this student.');
        return;
      }

      const newId = data.data.id as string;

      if (mode === 'create' && feeState && feeState.hasAnyInput) {
        const feeRes = await fetch('/api/student-fees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: newId,
            items: feeState.items.map((i) => ({ fee_head_id: i.fee_head_id, amount: Number(i.amount) })),
            installments: feeState.installments.map((i) => ({
              seq_no: i.seq_no,
              label: i.label,
              amount: Number(i.amount),
              due_date: i.due_date
            }))
          })
        });
        if (!feeRes.ok) {
          const feeData = await feeRes.json();
          setCreatedStudentId(newId);
          setError(
            `The student profile was created, but the fee could not be saved: ${feeData.message ?? 'please try again.'} Open the student's profile to add the fee.`
          );
          return;
        }
      }

      router.push(`/students/${newId}`);
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
          <label className="label">Admission Number *</label>
          <input className="input" required value={form.admission_number} onChange={(e) => update('admission_number', e.target.value)} />
        </div>
        <div>
          <label className="label">Parent / Guardian Name *</label>
          <input className="input" required value={form.guardian_name} onChange={(e) => update('guardian_name', e.target.value)} />
        </div>
        <div>
          <label className="label">Date of Birth *</label>
          <input
            type="date"
            className="input"
            required
            value={form.date_of_birth ?? ''}
            onChange={(e) => update('date_of_birth', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Admission Date *</label>
          <input
            type="date"
            className="input"
            required
            value={form.admission_date}
            onChange={(e) => update('admission_date', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Student Mobile</label>
          <input className="input" value={form.student_mobile} onChange={(e) => update('student_mobile', e.target.value)} />
        </div>
        <div>
          <label className="label">Parent Mobile *</label>
          <input className="input" required value={form.parent_mobile} onChange={(e) => update('parent_mobile', e.target.value)} />
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
          <label className="label">Address *</label>
          <textarea className="input" required value={form.address} onChange={(e) => update('address', e.target.value)} />
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-slate-800">Academic placement</legend>
        <div>
          <label className="label">Academic Year *</label>
          <select
            className="input"
            required
            value={form.academic_year_id ?? ''}
            onChange={(e) => update('academic_year_id', e.target.value)}
          >
            <option value="">Select…</option>
            {years.map((y) => (
              <option key={y.value} value={y.value}>
                {y.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Course / Class *</label>
          <select className="input" required value={form.course_id ?? ''} onChange={(e) => update('course_id', e.target.value)}>
            <option value="">Select…</option>
            {courses.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Branch *</label>
          <select className="input" required value={form.branch_id ?? ''} onChange={(e) => update('branch_id', e.target.value)}>
            <option value="">Select…</option>
            {branches.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Batch *</label>
          <select className="input" required value={form.batch_id ?? ''} onChange={(e) => update('batch_id', e.target.value)}>
            <option value="">Select…</option>
            {batches.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Board *</label>
          <select className="input" required value={form.board_id ?? ''} onChange={(e) => update('board_id', e.target.value)}>
            <option value="">Select…</option>
            {boards.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">School Name *</label>
          <input className="input" required value={form.school_name ?? ''} onChange={(e) => update('school_name', e.target.value)} />
        </div>
        <div>
          <label className="label">Last Year % *</label>
          <input
            className="input"
            required
            placeholder="e.g. 88% or First Class"
            value={form.last_year_percentage ?? ''}
            onChange={(e) => update('last_year_percentage', e.target.value)}
          />
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <div>
          <label className="label">Remarks *</label>
          <textarea className="input" required value={form.remarks ?? ''} onChange={(e) => update('remarks', e.target.value)} />
        </div>
        <div>
          <label className="label">Parent&apos;s Remarks *</label>
          <textarea
            className="input"
            required
            value={form.parent_remarks ?? ''}
            onChange={(e) => update('parent_remarks', e.target.value)}
          />
        </div>
      </div>

      {mode === 'create' && feeHeads && (
        <fieldset className="border-t border-slate-100 pt-4">
          <legend className="mb-2 text-sm font-semibold text-slate-800">Fee</legend>
          <FeeEntry
            admissionDate={form.admission_date}
            feeHeads={feeHeads}
            onChange={setFeeState}
            hint="Optional - enter the fee now, or skip this and add it later from the student's profile."
          />
        </fieldset>
      )}

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{error}</p>
          {createdStudentId && (
            <a href={`/students/${createdStudentId}`} className="mt-1 inline-block font-medium underline">
              Open {form.name || 'the student'}&apos;s profile
            </a>
          )}
        </div>
      )}

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
