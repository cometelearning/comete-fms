'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/utils/format';

interface StudentHit {
  id: string;
  student_code: string;
  name: string;
  student_mobile: string | null;
  parent_mobile: string | null;
}

interface InstallmentRow {
  id: string;
  label: string;
  amount: number;
  due_date: string;
  paid_amount: number;
  outstanding_amount: number;
  status: string;
}

interface AccountRow {
  student_fee_account_id: string;
  fee_structures: { name: string } | null;
  total_fee: number;
  discount_total: number;
  net_fee: number;
  paid_total: number;
  outstanding_total: number;
  overdue_amount: number;
  installments: InstallmentRow[];
}

const PAYMENT_MODES = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'OTHER'] as const;

export function CollectFee({ initialStudentId }: { initialStudentId?: string }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<StudentHit[]>([]);
  const [studentId, setStudentId] = useState<string | undefined>(initialStudentId);
  const [studentName, setStudentName] = useState<string>('');
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const [accountId, setAccountId] = useState<string>('');
  const [installmentId, setInstallmentId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [mode, setMode] = useState<(typeof PAYMENT_MODES)[number]>('CASH');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
  }, [studentId, accountId]);

  useEffect(() => {
    if (!q || studentId) {
      setHits([]);
      return;
    }
    const handle = setTimeout(() => {
      fetch(`/api/students?q=${encodeURIComponent(q)}&page=1`)
        .then((r) => r.json())
        .then((d) => setHits(d.data ?? []));
    }, 250);
    return () => clearTimeout(handle);
  }, [q, studentId]);

  useEffect(() => {
    if (!studentId) return;
    setLoadingAccounts(true);
    fetch(`/api/students/${studentId}/outstanding`)
      .then((r) => r.json())
      .then((d) => {
        setStudentName(d.data?.student?.name ?? '');
        setAccounts(d.data?.accounts ?? []);
        const firstWithOutstanding = (d.data?.accounts ?? []).find((a: AccountRow) => a.outstanding_total > 0);
        if (firstWithOutstanding) {
          setAccountId(firstWithOutstanding.student_fee_account_id);
        }
      })
      .finally(() => setLoadingAccounts(false));
  }, [studentId]);

  const selectedAccount = accounts.find((a) => a.student_fee_account_id === accountId);
  const selectedInstallment = selectedAccount?.installments.find((i) => i.id === installmentId);

  useEffect(() => {
    if (selectedInstallment) {
      setAmount(String(selectedInstallment.outstanding_amount));
    }
  }, [installmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  function selectStudent(hit: StudentHit) {
    setStudentId(hit.id);
    setStudentName(hit.name);
    setHits([]);
    setQ('');
  }

  function reset() {
    setStudentId(undefined);
    setStudentName('');
    setAccounts([]);
    setAccountId('');
    setInstallmentId('');
    setAmount('');
    setReference('');
    setRemarks('');
    router.replace('/collect-fee');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId || !amount || Number(amount) <= 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_fee_account_id: accountId,
          installment_id: installmentId || null,
          amount: Number(amount),
          payment_mode: mode,
          payment_date: paymentDate,
          reference_number: reference || null,
          remarks: remarks || null,
          idempotency_key: idempotencyKey
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not record this payment.');
        return;
      }
      router.push(`/receipts/${data.data.receipt_id}`);
    } finally {
      setSaving(false);
    }
  }

  const totalOutstanding = useMemo(() => accounts.reduce((sum, a) => sum + Number(a.outstanding_total), 0), [accounts]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Collect Fee</h1>

      {!studentId ? (
        <div className="card p-6">
          <label className="label">Search student by name, Student ID, admission number, mobile or email</label>
          <input className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Start typing…" />
          {hits.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-100 rounded-md border border-slate-200">
              {hits.map((h) => (
                <li key={h.id}>
                  <button type="button" className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-slate-50" onClick={() => selectStudent(h)}>
                    <span>
                      <span className="font-medium text-slate-900">{h.name}</span>{' '}
                      <span className="font-mono text-xs text-slate-400">{h.student_code}</span>
                    </span>
                    <span className="text-sm text-slate-500">{h.student_mobile ?? h.parent_mobile}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="card flex items-center justify-between p-4">
            <div>
              <p className="font-semibold text-slate-900">{studentName}</p>
              <p className="text-sm text-slate-500">
                Total outstanding across all fee accounts: <span className="font-semibold text-red-700">{formatCurrency(totalOutstanding)}</span>
              </p>
            </div>
            <button type="button" className="btn-secondary" onClick={reset}>
              Change student
            </button>
          </div>

          {loadingAccounts ? (
            <p className="text-sm text-slate-500">Loading outstanding fees…</p>
          ) : accounts.length === 0 ? (
            <p className="card p-6 text-sm text-slate-500">This student has no fee structure assigned yet.</p>
          ) : (
            <form onSubmit={submit} className="card space-y-5 p-6">
              <div>
                <label className="label">Fee account</label>
                <select
                  className="input"
                  value={accountId}
                  onChange={(e) => {
                    setAccountId(e.target.value);
                    setInstallmentId('');
                  }}
                >
                  {accounts.map((a) => (
                    <option key={a.student_fee_account_id} value={a.student_fee_account_id}>
                      {a.fee_structures?.name} - Outstanding {formatCurrency(a.outstanding_total)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedAccount && (
                <div>
                  <p className="label mb-2">Select installment</p>
                  <div className="space-y-2">
                    {selectedAccount.installments.map((i) => (
                      <label
                        key={i.id}
                        className={`flex cursor-pointer items-center justify-between rounded-md border p-3 text-sm ${
                          installmentId === i.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="installment"
                            checked={installmentId === i.id}
                            onChange={() => setInstallmentId(i.id)}
                            disabled={i.status === 'PAID' || i.status === 'WAIVED'}
                          />
                          <span>
                            <span className="font-medium">{i.label}</span>{' '}
                            <span className="text-slate-400">(due {formatDate(i.due_date)})</span>
                          </span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="text-slate-600">Outstanding {formatCurrency(i.outstanding_amount)}</span>
                          <Badge status={i.status} />
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Any amount above the selected installment is automatically applied to the next unpaid installments.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Amount *</label>
                  <input type="number" min="0.01" step="0.01" required className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div>
                  <label className="label">Payment date</label>
                  <input type="date" className="input" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
                <div>
                  <label className="label">Payment mode *</label>
                  <select className="input" value={mode} onChange={(e) => setMode(e.target.value as (typeof PAYMENT_MODES)[number])}>
                    {PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Reference / Transaction number</label>
                  <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional for cash" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Remarks</label>
                  <input className="input" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                </div>
              </div>

              {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

              <button type="submit" disabled={saving || !amount} className="btn-primary w-full text-base">
                {saving ? 'Saving payment…' : 'Save Payment & Generate Receipt'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
