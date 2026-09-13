'use client';

import { useState } from 'react';
import Link from 'next/link';

export function TeacherSharePolicyForm({ initialPercent }: { initialPercent: number }) {
  const [percent, setPercent] = useState(String(initialPercent));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(percent);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setError('Enter a percentage between 0 and 100.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/teacher-share', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ percent: value })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not save.');
        return;
      }
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card space-y-4 p-6">
      <div>
        <h2 className="font-semibold text-slate-800">Teacher Tuition Share</h2>
        <p className="mt-1 text-xs text-slate-400">
          Some teachers hold a % share of the tuition portion of specific students&apos; fees (never Admission, Study Material or Examination
          Fee - those are always deducted first). Manage which teachers hold a share on which students under{' '}
          <Link href="/teacher-shares" className="font-medium text-brand-600 hover:underline">
            Teacher Shares
          </Link>
          , and view the calculated amounts under{' '}
          <Link href="/reports/teacher-shares" className="font-medium text-brand-600 hover:underline">
            Reports → Teacher Share Report
          </Link>
          . This only calculates and displays figures from fees already collected - it does not process any payment to a teacher.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div className="max-w-xs">
          <label className="label">Of a teacher&apos;s computed tuition share, % that actually goes to the teacher</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="input"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
            />
            <span className="text-sm text-slate-500">%</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">The remaining % stays with the institute as ordinary tuition revenue.</p>
        </div>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save'}
          </button>
          {savedAt && <span className="text-xs text-emerald-600">Saved.</span>}
        </div>
      </form>
    </div>
  );
}
