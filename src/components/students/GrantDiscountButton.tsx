'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function GrantDiscountButton({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [installments, setInstallments] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [installmentId, setInstallmentId] = useState('');
  const [type, setType] = useState<'FIXED' | 'PERCENTAGE'>('FIXED');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/student-fee-accounts/${accountId}/installments`)
      .then((r) => r.json())
      .then((d) => setInstallments(d.data ?? []));
  }, [open, accountId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_fee_account_id: accountId,
          installment_id: installmentId || null,
          discount_type: type,
          value: Number(value),
          reason
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not apply this discount.');
        return;
      }
      setOpen(false);
      setValue('');
      setReason('');
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setOpen(true)}>
        Apply Discount
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="mb-4 text-lg font-semibold">Apply Discount / Concession</h2>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="label">Applies to</label>
                <select className="input" value={installmentId} onChange={(e) => setInstallmentId(e.target.value)}>
                  <option value="">Whole fee account</option>
                  {installments
                    .filter((i) => i.status !== 'PAID' && i.status !== 'WAIVED')
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.label}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="label">Type</label>
                  <select className="input" value={type} onChange={(e) => setType(e.target.value as 'FIXED' | 'PERCENTAGE')}>
                    <option value="FIXED">Fixed amount (₹)</option>
                    <option value="PERCENTAGE">Percentage (%)</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="label">Value</label>
                  <input type="number" min="0" step="0.01" required className="input" value={value} onChange={(e) => setValue(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Reason *</label>
                <textarea className="input" required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Applying…' : 'Apply Discount'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
