'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils/format';

interface Structure {
  id: string;
  name: string;
  total_fee: number;
}

export function AssignFeeButton({ studentId, structures }: { studentId: string; structures: Structure[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [structureId, setStructureId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!structureId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/student-fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, fee_structure_id: structureId })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not assign this fee structure.');
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
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        + Assign Fee Structure
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="mb-4 text-lg font-semibold">Assign Fee Structure</h2>
            <label className="label">Fee structure</label>
            <select className="input" value={structureId} onChange={(e) => setStructureId(e.target.value)}>
              <option value="">Select…</option>
              {structures.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({formatCurrency(s.total_fee)})
                </option>
              ))}
            </select>
            {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={!structureId || saving} onClick={submit}>
                {saving ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
