'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FeeEntry, type FeeEntryState, type FeeHeadOption, type FeeItemRow, type FeeInstallmentRow } from '@/components/fee/FeeEntry';

interface Props {
  feeHeads: FeeHeadOption[];
  admissionDate: string;
  buttonLabel: string;
  buttonClassName?: string;
  /** Create mode: pass the student to attach a brand-new fee to. */
  studentId?: string;
  /** Edit mode: pass the existing (unpaid, no-discount) fee account to fix. */
  accountId?: string;
}

/**
 * Add or fix a student's fee, directly - no separate reusable Fee Structure
 * to pick from. In "add" mode this always creates a new fee account (so it
 * also covers "assign a fee for next year" or "this student didn't get one
 * at creation"). In "edit" mode it can only be used before any payment or
 * discount has touched the account (enforced server-side too).
 */
export function FeeAccountDialog({ feeHeads, admissionDate, buttonLabel, buttonClassName, studentId, accountId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialItems, setInitialItems] = useState<FeeItemRow[] | undefined>(undefined);
  const [initialInstallments, setInitialInstallments] = useState<FeeInstallmentRow[] | undefined>(undefined);
  const [feeState, setFeeState] = useState<FeeEntryState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!accountId;

  useEffect(() => {
    if (!open || !isEdit) return;
    setLoading(true);
    fetch(`/api/student-fee-accounts/${accountId}`)
      .then((r) => r.json())
      .then((d) => {
        setInitialItems((d.data?.items ?? []).map((i: any) => ({ fee_head_id: i.fee_head_id, amount: String(i.amount) }))); // eslint-disable-line @typescript-eslint/no-explicit-any
        setInitialInstallments(
          (d.data?.installments ?? []).map((i: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
            seq_no: i.seq_no,
            label: i.label,
            amount: String(i.amount),
            due_date: i.due_date
          }))
        );
      })
      .finally(() => setLoading(false));
  }, [open, isEdit, accountId]);

  function feeIsIncomplete() {
    if (!feeState) return true;
    const itemsValid = feeState.items.every((i) => i.fee_head_id && Number(i.amount) > 0);
    return !itemsValid || feeState.installments.length === 0 || !feeState.balanced;
  }

  async function submit() {
    setError(null);
    if (feeIsIncomplete()) {
      setError('Every fee head needs an amount, and the installments must add up to the total fee.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        items: feeState!.items.map((i) => ({ fee_head_id: i.fee_head_id, amount: Number(i.amount) })),
        installments: feeState!.installments.map((i) => ({ seq_no: i.seq_no, label: i.label, amount: Number(i.amount), due_date: i.due_date }))
      };
      const res = isEdit
        ? await fetch(`/api/student-fee-accounts/${accountId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
        : await fetch('/api/student-fees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id: studentId, ...payload })
          });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not save this fee.');
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
      <button type="button" className={buttonClassName ?? 'btn-secondary'} onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
            <h2 className="mb-4 text-lg font-semibold">{isEdit ? 'Edit Fee' : 'Add Fee'}</h2>
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : (
              <FeeEntry admissionDate={admissionDate} feeHeads={feeHeads} initialItems={initialItems} initialInstallments={initialInstallments} onChange={setFeeState} />
            )}
            {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={saving || loading} onClick={submit}>
                {saving ? 'Saving…' : 'Save Fee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
