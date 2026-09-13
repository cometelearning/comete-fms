'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FieldOption } from '@/components/masters/MasterCrudPage';

interface StudentHit {
  id: string;
  student_code: string;
  name: string;
}

interface ShareInitial {
  teacher_id: string;
  share_percentage: number;
  effective_from: string;
  effective_to: string | null;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export function TeacherShareDialog({
  mode,
  recordId,
  studentLabel,
  initial,
  teachers,
  buttonLabel,
  buttonClassName
}: {
  mode: 'create' | 'edit';
  recordId?: string;
  studentLabel?: string;
  initial?: ShareInitial;
  teachers: FieldOption[];
  buttonLabel: string;
  buttonClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [q, setQ] = useState('');
  const [hits, setHits] = useState<StudentHit[]>([]);
  const [pickedStudentId, setPickedStudentId] = useState<string | undefined>(undefined);
  const [pickedStudentLabel, setPickedStudentLabel] = useState<string | undefined>(studentLabel);

  const [teacherId, setTeacherId] = useState(initial?.teacher_id ?? '');
  const [sharePercentage, setSharePercentage] = useState(initial?.share_percentage != null ? String(initial.share_percentage) : '');
  const [effectiveFrom, setEffectiveFrom] = useState(initial?.effective_from ?? todayStr());
  const [effectiveTo, setEffectiveTo] = useState(initial?.effective_to ?? '');
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
    setPickedStudentId(undefined);
    setPickedStudentLabel(studentLabel);
    setQ('');
    setHits([]);
    setTeacherId(initial?.teacher_id ?? '');
    setSharePercentage(initial?.share_percentage != null ? String(initial.share_percentage) : '');
    setEffectiveFrom(initial?.effective_from ?? todayStr());
    setEffectiveTo(initial?.effective_to ?? '');
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'create' && !pickedStudentId) {
      setError('Select a student first.');
      return;
    }
    const pct = Number(sharePercentage);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      setError('Enter a share percentage between 0 and 100.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = mode === 'create' ? '/api/teacher-shares' : `/api/teacher-shares/${recordId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const body =
        mode === 'create'
          ? {
              teacher_id: teacherId,
              student_id: pickedStudentId,
              share_percentage: pct,
              effective_from: effectiveFrom,
              effective_to: effectiveTo || undefined
            }
          : { share_percentage: pct, effective_from: effectiveFrom, effective_to: effectiveTo || null };
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not save this teacher share.');
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
            <h2 className="mb-4 text-lg font-semibold">{mode === 'create' ? 'Add Teacher Share' : 'Edit Teacher Share'}</h2>
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
                  <div className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900">{pickedStudentLabel}</div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Teacher *</label>
                  <select
                    className="input"
                    required
                    disabled={mode === 'edit'}
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {teachers.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
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
