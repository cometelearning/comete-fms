'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils/format';
import type { FieldOption } from '@/components/masters/MasterCrudPage';

interface FeeHeadOption {
  value: string;
  label: string;
}

interface ItemRow {
  fee_head_id: string;
  amount: string;
}
interface InstallmentRow {
  seq_no: number;
  label: string;
  amount: string;
  due_date: string;
}

export function FeeStructureBuilder({
  years,
  courses,
  feeHeads
}: {
  years: FieldOption[];
  courses: FieldOption[];
  feeHeads: FeeHeadOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [items, setItems] = useState<ItemRow[]>([{ fee_head_id: '', amount: '' }]);
  const [installments, setInstallments] = useState<InstallmentRow[]>([
    { seq_no: 1, label: 'Installment 1', amount: '', due_date: '' }
  ]);
  const [autoCount, setAutoCount] = useState(3);
  const [autoStart, setAutoStart] = useState('');
  const [autoIntervalMonths, setAutoIntervalMonths] = useState(2);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalFee = useMemo(() => items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0), [items]);
  const installmentTotal = useMemo(() => installments.reduce((sum, i) => sum + (Number(i.amount) || 0), 0), [installments]);
  const balanced = totalFee > 0 && Math.abs(totalFee - installmentTotal) < 0.01;

  function updateItem(idx: number, patch: Partial<ItemRow>) {
    setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addItem() {
    setItems((rows) => [...rows, { fee_head_id: '', amount: '' }]);
  }
  function removeItem(idx: number) {
    setItems((rows) => rows.filter((_, i) => i !== idx));
  }

  function updateInstallment(idx: number, patch: Partial<InstallmentRow>) {
    setInstallments((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function addInstallment() {
    setInstallments((rows) => [...rows, { seq_no: rows.length + 1, label: `Installment ${rows.length + 1}`, amount: '', due_date: '' }]);
  }
  function removeInstallment(idx: number) {
    setInstallments((rows) => rows.filter((_, i) => i !== idx).map((r, i) => ({ ...r, seq_no: i + 1 })));
  }

  function autoGenerate() {
    if (totalFee <= 0 || autoCount <= 0 || !autoStart) return;
    const base = Math.floor((totalFee / autoCount) * 100) / 100;
    const rows: InstallmentRow[] = [];
    let allocated = 0;
    const start = new Date(autoStart);
    for (let i = 0; i < autoCount; i++) {
      const isLast = i === autoCount - 1;
      const amount = isLast ? Math.round((totalFee - allocated) * 100) / 100 : base;
      allocated += amount;
      const due = new Date(start);
      due.setMonth(due.getMonth() + i * autoIntervalMonths);
      rows.push({ seq_no: i + 1, label: `Installment ${i + 1}`, amount: amount.toFixed(2), due_date: due.toISOString().slice(0, 10) });
    }
    setInstallments(rows);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!balanced) {
      setError('Installment amounts must add up to exactly the total fee before saving.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/fee-structures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          academic_year_id: academicYearId,
          course_id: courseId,
          batch_id: null,
          items: items.filter((i) => i.fee_head_id && i.amount).map((i) => ({ fee_head_id: i.fee_head_id, amount: Number(i.amount) })),
          installments: installments
            .filter((i) => i.amount && i.due_date)
            .map((i) => ({ seq_no: i.seq_no, label: i.label, amount: Number(i.amount), due_date: i.due_date }))
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not save this fee structure.');
        return;
      }
      router.push(`/fee-structures/${data.data.id}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="card grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Fee structure name *</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Class 12 Commerce - 2026-27" />
        </div>
        <div>
          <label className="label">Academic Year *</label>
          <select className="input" required value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}>
            <option value="">Select…</option>
            {years.map((y) => (
              <option key={y.value} value={y.value}>
                {y.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Course *</label>
          <select className="input" required value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Select…</option>
            {courses.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Fee heads</h2>
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
              <button type="button" className="btn-ghost text-red-600" onClick={() => removeItem(idx)}>
                Remove
              </button>
            </div>
          ))}
        </div>
        <p className="mt-3 text-right text-sm font-semibold text-slate-800">Total Fee: {formatCurrency(totalFee)}</p>
      </div>

      <div className="card p-6">
        <h2 className="mb-3 font-semibold text-slate-800">Installment schedule</h2>
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md bg-slate-50 p-3">
          <div>
            <label className="label">Number of installments</label>
            <input type="number" min="1" className="input w-28" value={autoCount} onChange={(e) => setAutoCount(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">First due date</label>
            <input type="date" className="input" value={autoStart} onChange={(e) => setAutoStart(e.target.value)} />
          </div>
          <div>
            <label className="label">Months between installments</label>
            <input
              type="number"
              min="1"
              className="input w-28"
              value={autoIntervalMonths}
              onChange={(e) => setAutoIntervalMonths(Number(e.target.value))}
            />
          </div>
          <button type="button" className="btn-secondary" onClick={autoGenerate} disabled={totalFee <= 0}>
            Auto-generate
          </button>
        </div>

        <div className="space-y-2">
          {installments.map((row, idx) => (
            <div key={idx} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                className="input sm:w-40"
                value={row.label}
                onChange={(e) => updateInstallment(idx, { label: e.target.value })}
              />
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
        <button type="button" className="btn-secondary mt-3" onClick={addInstallment}>
          + Add installment
        </button>

        <p className={`mt-3 text-right text-sm font-semibold ${balanced ? 'text-emerald-700' : 'text-red-700'}`}>
          Installments total: {formatCurrency(installmentTotal)} {balanced ? '(matches total fee)' : `(must equal ${formatCurrency(totalFee)})`}
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={() => router.back()}>
          Cancel
        </button>
        <button type="submit" disabled={saving || !balanced} className="btn-primary">
          {saving ? 'Saving…' : 'Save Fee Structure'}
        </button>
      </div>
    </form>
  );
}
