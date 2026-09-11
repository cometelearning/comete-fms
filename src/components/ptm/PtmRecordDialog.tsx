'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface StudentHit {
  id: string;
  student_code: string;
  name: string;
}

interface PtmInitial {
  ptm_date: string;
  attended: boolean;
  parent_remarks: string | null;
  counsellor_remarks: string | null;
}

interface Props {
  mode: 'create' | 'edit';
  recordId?: string; // edit mode
  studentId?: string; // create mode, when opened from a student's own profile
  studentLabel?: string; // display name - required for edit, optional for a preset create
  initial?: PtmInitial; // edit mode - the row's current values, passed in directly (no extra fetch)
  buttonLabel: string;
  buttonClassName?: string;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export function PtmRecordDialog({ mode, recordId, studentId, studentLabel, initial, buttonLabel, buttonClassName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Student picker (only used in create mode without a preset studentId)
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<StudentHit[]>([]);
  const [pickedStudentId, setPickedStudentId] = useState<string | undefined>(studentId);
  const [pickedStudentLabel, setPickedStudentLabel] = useState<string | undefined>(studentLabel);

  const [ptmDate, setPtmDate] = useState(initial?.ptm_date ?? todayStr());
  const [attended, setAttended] = useState(initial?.attended ?? true);
  const [parentRemarks, setParentRemarks] = useState(initial?.parent_remarks ?? '');
  const [counsellorRemarks, setCounsellorRemarks] = useState(initial?.counsellor_remarks ?? '');
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
    setPtmDate(initial?.ptm_date ?? todayStr());
    setAttended(initial?.attended ?? true);
    setParentRemarks(initial?.parent_remarks ?? '');
    setCounsellorRemarks(initial?.counsellor_remarks ?? '');
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
      const url = mode === 'create' ? '/api/ptm-records' : `/api/ptm-records/${recordId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const body =
        mode === 'create'
          ? { student_id: pickedStudentId, ptm_date: ptmDate, attended, parent_remarks: parentRemarks, counsellor_remarks: counsellorRemarks }
          : { ptm_date: ptmDate, attended, parent_remarks: parentRemarks, counsellor_remarks: counsellorRemarks };
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not save this PTM record.');
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
            <h2 className="mb-4 text-lg font-semibold">{mode === 'create' ? 'Add PTM Record' : 'Edit PTM Record'}</h2>
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
                  <label className="label">Date of PTM *</label>
                  <input type="date" className="input" required value={ptmDate} onChange={(e) => setPtmDate(e.target.value)} />
                </div>
                <div>
                  <label className="label">Attended *</label>
                  <select className="input" value={attended ? 'yes' : 'no'} onChange={(e) => setAttended(e.target.value === 'yes')}>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Parent&apos;s Remarks</label>
                <textarea className="input" value={parentRemarks ?? ''} onChange={(e) => setParentRemarks(e.target.value)} />
              </div>
              <div>
                <label className="label">Counsellor Remarks</label>
                <textarea className="input" value={counsellorRemarks ?? ''} onChange={(e) => setCounsellorRemarks(e.target.value)} />
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
