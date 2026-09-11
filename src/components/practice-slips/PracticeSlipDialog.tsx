'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FieldOption } from '@/components/masters/MasterCrudPage';

interface StudentHit {
  id: string;
  student_code: string;
  name: string;
}

interface SlipInitial {
  subject_id: string;
  slip_date: string;
  topic: string;
  level: string;
}

const LEVEL_OPTIONS = [
  { value: 'LEVEL_1', label: 'Level 1' },
  { value: 'LEVEL_2', label: 'Level 2' },
  { value: 'LEVEL_3', label: 'Level 3' },
  { value: 'NA', label: 'NA' }
];

const todayStr = () => new Date().toISOString().slice(0, 10);

export function PracticeSlipDialog({
  mode,
  recordId,
  studentId,
  studentLabel,
  initial,
  subjects,
  buttonLabel,
  buttonClassName
}: {
  mode: 'create' | 'edit';
  recordId?: string;
  studentId?: string; // create mode, when opened from a student's own profile
  studentLabel?: string;
  initial?: SlipInitial;
  subjects: FieldOption[];
  buttonLabel: string;
  buttonClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [q, setQ] = useState('');
  const [hits, setHits] = useState<StudentHit[]>([]);
  const [pickedStudentId, setPickedStudentId] = useState<string | undefined>(studentId);
  const [pickedStudentLabel, setPickedStudentLabel] = useState<string | undefined>(studentLabel);

  const [subjectId, setSubjectId] = useState(initial?.subject_id ?? '');
  const [slipDate, setSlipDate] = useState(initial?.slip_date ?? todayStr());
  const [topic, setTopic] = useState(initial?.topic ?? '');
  const [level, setLevel] = useState(initial?.level ?? 'NA');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q || pickedStudentId) {
      setHits([]);
      return;
    }
    const handle = setTimeout(() => {
      fetch(`/api/students?q=${encodeURIComponent(q)}&page=1`)
        .then((r) => r.json())
        .then((d) => setHits((d.data ?? []).map((s: any) => ({ id: s.id, student_code: s.student_code, name: s.name })))); // eslint-disable-line @typescript-eslint/no-explicit-any
    }, 250);
    return () => clearTimeout(handle);
  }, [q, pickedStudentId]);

  function reset() {
    setPickedStudentId(studentId);
    setPickedStudentLabel(studentLabel);
    setQ('');
    setHits([]);
    setSubjectId(initial?.subject_id ?? '');
    setSlipDate(initial?.slip_date ?? todayStr());
    setTopic(initial?.topic ?? '');
    setLevel(initial?.level ?? 'NA');
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'create' && !pickedStudentId) {
      setError('Select a student first.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = mode === 'create' ? '/api/practice-slips' : `/api/practice-slips/${recordId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const body =
        mode === 'create'
          ? { student_id: pickedStudentId, subject_id: subjectId, slip_date: slipDate, topic, level }
          : { subject_id: subjectId, slip_date: slipDate, topic, level };
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not save this practice slip.');
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={buttonClassName ?? 'btn-primary'}
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        {buttonLabel}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-lg p-6">
            <h2 className="mb-4 text-lg font-semibold">{mode === 'create' ? 'Add Practice Slip' : 'Edit Practice Slip'}</h2>
            <form onSubmit={submit} className="space-y-4">
              {mode === 'create' && !pickedStudentId ? (
                <div>
                  <label className="label">Student *</label>
                  <input
                    className="input"
                    autoFocus
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search by name, Student ID, admission number…"
                  />
                  {hits.length > 0 && (
                    <ul className="mt-2 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
                      {hits.map((h) => (
                        <li key={h.id}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                            onClick={() => {
                              setPickedStudentId(h.id);
                              setPickedStudentLabel(h.name);
                              setHits([]);
                              setQ('');
                            }}
                          >
                            <span className="font-medium text-slate-900">{h.name}</span>
                            <span className="font-mono text-xs text-slate-400">{h.student_code}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div>
                  <label className="label">Student</label>
                  <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-900">{pickedStudentLabel}</span>
                    {mode === 'create' && !studentId && (
                      <button
                        type="button"
                        className="text-xs font-medium text-brand-600 hover:underline"
                        onClick={() => {
                          setPickedStudentId(undefined);
                          setPickedStudentLabel(undefined);
                        }}
                      >
                        Change
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Subject *</label>
                  <select className="input" required value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                    <option value="">Select…</option>
                    {subjects.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Date *</label>
                  <input type="date" className="input" required value={slipDate} onChange={(e) => setSlipDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Practice Slip Topic *</label>
                <input className="input" required value={topic} onChange={(e) => setTopic(e.target.value)} />
              </div>
              <div>
                <label className="label">Level *</label>
                <select className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
                  {LEVEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
