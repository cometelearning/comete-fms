'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/utils/format';

export interface FeeHeadOption {
  value: string;
  label: string;
}

export interface FeeItemRow {
  fee_head_id: string;
  amount: string;
}

export interface FeeInstallmentRow {
  seq_no: number;
  label: string;
  amount: string;
  due_date: string;
}

export interface FeeEntryState {
  items: FeeItemRow[];
  installments: FeeInstallmentRow[];
  totalFee: number;
  installmentTotal: number;
  balanced: boolean;
  hasAnyInput: boolean;
}

interface Props {
  /** Installment 1 is generated on this date (yyyy-mm-dd) - normally the student's admission date. */
  admissionDate: string;
  feeHeads: FeeHeadOption[];
  initialItems?: FeeItemRow[];
  initialInstallments?: FeeInstallmentRow[];
  onChange: (state: FeeEntryState) => void;
  /** Small note shown under the heading, e.g. to say this section is optional. */
  hint?: string;
}

export function FeeEntry({ admissionDate, feeHeads, initialItems, initialInstallments, onChange, hint }: Props) {
  const [items, setItems] = useState<FeeItemRow[]>(
    initialItems && initialItems.length > 0 ? initialItems : [{ fee_head_id: '', amount: '' }]
  );
  const [installments, setInstallments] = useState<FeeInstallmentRow[]>(initialInstallments ?? []);
  const [installmentCount, setInstallmentCount] = useState(initialInstallments?.length || 3);
  const [intervalMonths, setIntervalMonths] = useState(1);

  const totalFee = useMemo(() => items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0), [items]);
  const installmentTotal = useMemo(() => installments.reduce((sum, i) => sum + (Number(i.amount) || 0), 0), [installments]);
  const balanced = totalFee > 0 && installments.length > 0 && Math.abs(totalFee - installmentTotal) < 0.01;
  const hasAnyInput = items.some((i) => i.fee_head_id || i.amount) || installments.length > 0;

  useEffect(() => {
    onChange({ items, installments, totalFee, installmentTotal, balanced, hasAnyInput });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, installments, totalFee, installmentTotal, balanced, hasAnyInput]);

  function updateItem(idx: number, patch: Partial<FeeItemRow>) {
    setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addItem() {
    setItems((rows) => [...rows, { fee_head_id: '', amount: '' }]);
  }
  function removeItem(idx: number) {
    setItems((rows) => rows.filter((_, i) => i !== idx));
  }

  function generateInstallments() {
    if (totalFee <= 0 || installmentCount <= 0 || !admissionDate) return;
    const base = Math.floor((totalFee / installmentCount) * 100) / 100;
    const rows: FeeInstallmentRow[] = [];
    let allocated = 0;
    const start = new Date(admissionDate);
    for (let i = 0; i < installmentCount; i++) {
      const isLast = i === installmentCount - 1;
      const amount = isLast ? Math.round((totalFee - allocated) * 100) / 100 : base;
      allocated += amount;
      const due = new Date(start);
      due.setMonth(due.getMonth() + i * intervalMonths);
      rows.push({ seq_no: i + 1, label: `Installment ${i + 1}`, amount: amount.toFixed(2), due_date: due.toISOString().slice(0, 10) });
    }
    setInstallments(rows);
  }

  function updateInstallment(idx: number, patch: Partial<FeeInstallmentRow>) {
    setInstallments((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addInstallmentRow() {
    setInstallments((rows) => [
      ...rows,
      { seq_no: rows.length + 1, label: `Installment ${rows.length + 1}`, amount: '', due_date: admissionDate || '' }
    ]);
  }
  function removeInstallment(idx: number) {
    setInstallments((rows) => rows.filter((_, i) => i !== idx).map((r, i) => ({ ...r, seq_no: i + 1 })));
  }

  return (
    <div className="space-y-4">
      {hint && <p className="text-xs text-slate-400">{hint}</p>}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="label mb-0">Fee heads</label>
          <button type="button" className="btn-secondary" onClick={addItem}>
            + Add fee head
          </button>
        </div>
        <div className="space-y-2">
          {items.map((row, idx) => (
            <div key={idx} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                className="input sm:flex-1"
                value={row.fee_head_id}
                onChange={(e) => updateItem(idx, { fee_head_id: e.target.value })}
              >
                <option value="">Select fee head…</option>
                {feeHeads.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input sm:w-40"
                placeholder="Amount"
                value={row.amount}
                onChange={(e) => updateItem(idx, { amount: e.target.value })}
              />
              {items.length > 1 && (
                <button type="button" className="btn-ghost text-red-600" onClick={() => removeItem(idx)}>
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-right text-sm font-semibold text-slate-800">Total Fee: {formatCurrency(totalFee)}</p>
      </div>

      <div className="rounded-md bg-slate-50 p-3">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Number of installments</label>
            <input
              type="number"
              min="1"
              className="input w-28"
              value={installmentCount}
              onChange={(e) => setInstallmentCount(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">Months between installments</label>
            <input
              type="number"
              min="1"
              className="input w-28"
              value={intervalMonths}
              onChange={(e) => setIntervalMonths(Number(e.target.value))}
            />
          </div>
          <button type="button" className="btn-secondary" onClick={generateInstallments} disabled={totalFee <= 0}>
            Generate Schedule
          </button>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          The first installment is due on the admission date and later ones are spaced automatically - you can still adjust any
          amount or date below.
        </p>

        {installments.length > 0 && (
          <>
            <div className="space-y-2">
              {installments.map((row, idx) => (
                <div key={idx} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input className="input sm:w-40" value={row.label} onChange={(e) => updateInstallment(idx, { label: e.target.value })} />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input sm:w-36"
                    placeholder="Amount"
                    value={row.amount}
                    onChange={(e) => updateInstallment(idx, { amount: e.target.value })}
                  />
                  <input
                    type="date"
                    className="input sm:w-44"
                    value={row.due_date}
                    onChange={(e) => updateInstallment(idx, { due_date: e.target.value })}
                  />
                  <button type="button" className="btn-ghost text-red-600" onClick={() => removeInstallment(idx)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn-secondary mt-3" onClick={addInstallmentRow}>
              + Add installment
            </button>
            <p className={`mt-3 text-right text-sm font-semibold ${balanced ? 'text-emerald-700' : 'text-red-700'}`}>
              Installments total: {formatCurrency(installmentTotal)}{' '}
              {balanced ? '(matches total fee)' : `(must equal ${formatCurrency(totalFee)})`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
