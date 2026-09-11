'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FieldOption } from '@/components/masters/MasterCrudPage';

interface SubjectInitial {
  name: string;
  class_ids: string[];
}

/**
 * Subjects are many-to-many with Classes (migration 0022): one subject
 * (e.g. "Maths") is tagged to however many classes it's taught in, via a
 * checkbox list rather than the single "Class" dropdown MasterCrudPage
 * assumes - so subjects gets its own dialog instead of reusing that
 * generic component. Labelled "Classes" throughout, never "Course" - Course
 * is a separate master and unrelated to this mapping.
 */
export function SubjectDialog({
  mode,
  recordId,
  initial,
  classes,
  buttonLabel,
  buttonClassName
}: {
  mode: 'create' | 'edit';
  recordId?: string;
  initial?: SubjectInitial;
  classes: FieldOption[];
  buttonLabel: string;
  buttonClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? '');
  const [classIds, setClassIds] = useState<string[]>(initial?.class_ids ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName(initial?.name ?? '');
    setClassIds(initial?.class_ids ?? []);
    setError(null);
  }

  function toggleClass(id: string) {
    setClassIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (classIds.length === 0) {
      setError('Select at least one class.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = mode === 'create' ? '/api/subjects' : `/api/subjects/${recordId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, class_ids: classIds })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not save this subject.');
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
            <h2 className="mb-4 text-lg font-semibold">{mode === 'create' ? 'Add Subject' : 'Edit Subject'}</h2>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Subject name *</label>
                <input className="input" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="label">Classes *</label>
                <p className="mb-2 text-xs text-slate-400">Select every class this subject is taught in.</p>
                <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto rounded-md border border-slate-200 p-3 sm:grid-cols-3">
                  {classes.map((c) => (
                    <label key={c.value} className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={classIds.includes(c.value)} onChange={() => toggleClass(c.value)} />
                      {c.label}
                    </label>
                  ))}
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
