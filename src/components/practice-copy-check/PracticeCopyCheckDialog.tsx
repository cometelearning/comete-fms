'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FieldOption } from '@/components/masters/MasterCrudPage';

interface StudentHit {
  id: string;
  student_code: string;
  name: string;
}

interface CopyCheckInitial {
  check_date: string;
  teacher_id: string;
  remarks: string | null;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export function PracticeCopyCheckDialog({
  mode,
  recordId,
  studentId,
  studentLabel,
  initial,
  teachers,
  buttonLabel,
  buttonClassName
}: {
  mode: 'create' | 'edit';
  recordId?: string;
  studentId?: string; // create mode, when opened from a student's own profile
  studentLabel?: string;
  initial?: CopyCheckInitial;
  teachers: FieldOption[];
  buttonLabel: string;
  buttonClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [q, setQ] = useState('');
  const [hits, setHits] = useState<StudentHit[]>([]);
  const [pickedStudentId, setPickedStudentId] = useState<string | undefined>(studentId);
  const [pickedStudentLabel, setPickedStudentLabel] = useState<string | undefined>(studentLabel);

  const [checkDate, setCheckDate] = useState(initial?.check_date ?? todayStr());
  const [teacherId, setTeacherId] = useState(initial?.teacher_id ?? '');
  const [remarks, setRemarks] = useState(initial?.remarks ?? '');
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
    setCheckDate(initial?.check_date ?? todayStr());
    setTeacherId(initial?.teacher_id ?? '');
    setRemarks(initial?.remarks ?? '');
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
      const url = mode === 'create' ? '/api/practice-copy-checks' : `/api/practice-copy-checks/${recordId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const body =
        mode === 'create'
          ? { student_id: pickedStudentId, check_date: checkDate, teacher_id: teacherId, remarks: remarks || undefined }
          : { check_date: checkDate, teacher_id: teacherId, remarks: remarks || null };
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not save this practice copy check.');
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
            <h2 className="mb-4 text-lg font-semibold">{mode === 'create' ? 'Add Practice Copy Check' : 'Edit Practice Copy Check'}</h2>
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
                  <label className="label">Date Checked *</label>
                  <input type="date" className="input" required value={checkDate} onChange={(e) => setCheckDate(e.target.value)} />
                </div>
                <div>
                  <label className="label">Teacher (Signed) *</label>
                  <select className="input" required value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                    <option value="">Select…</option>
                    {teachers.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Remarks</label>
                <textarea className="input" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
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
