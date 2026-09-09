'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';

export function ReceiptView({ receiptId, canCancel }: { receiptId: string; canCancel: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [loading, setLoading] = useState(true);
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch(`/api/receipts/${receiptId}`)
      .then((r) => r.json())
      .then((d) => setData(d.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptId]);

  async function submitCancel(e: React.FormEvent) {
    e.preventDefault();
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/receipts/${receiptId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const body = await res.json();
      if (!res.ok) {
        setCancelError(body.message ?? 'Could not cancel this receipt.');
        return;
      }
      setShowCancel(false);
      load();
      router.refresh();
    } finally {
      setCancelling(false);
    }
  }

  async function emailReceipt() {
    setEmailStatus('Sending…');
    const res = await fetch(`/api/receipts/${receiptId}/email`, { method: 'POST' });
    const body = await res.json();
    setEmailStatus(res.ok ? `Sent to ${body.data.to}` : body.message);
  }

  if (loading || !data) return <p className="text-sm text-slate-500">Loading receipt…</p>;

  const { receipt, payment, student, installmentLabel, previousOutstanding, currentOutstanding } = data;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900">Receipt {receipt.receipt_number}</h1>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => window.print()}>
            Print
          </button>
          <a className="btn-secondary" href={`/api/receipts/${receiptId}/pdf`} target="_blank" rel="noreferrer">
            Download PDF
          </a>
          <button className="btn-secondary" onClick={emailReceipt}>
            Email Receipt
          </button>
          {canCancel && receipt.status === 'ACTIVE' && (
            <button className="btn-danger" onClick={() => setShowCancel(true)}>
              Cancel Receipt
            </button>
          )}
        </div>
      </div>
      {emailStatus && <p className="no-print mb-4 text-sm text-slate-500">{emailStatus}</p>}

      <div className="card p-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-lg font-bold text-brand-700">COMETE LEARNING</p>
            <p className="text-xs text-slate-500">Fee Receipt</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{receipt.receipt_number}</p>
            <p className="text-xs text-slate-500">{formatDateTime(receipt.issued_at)}</p>
            <Badge status={receipt.status} />
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 border-y border-slate-100 py-4 text-sm">
          <Field label="Student" value={student.name} />
          <Field label="Student ID" value={student.student_code} />
          <Field label="Guardian" value={student.guardian_name} />
          <Field label="Course" value={student.courses?.name} />
          <Field label="Batch" value={student.batches?.name} />
          <Field label="Installment" value={installmentLabel} />
        </div>

        <div className="space-y-2 text-sm">
          <Row label="Previous Outstanding" value={formatCurrency(previousOutstanding)} />
          <Row label="Amount Received" value={formatCurrency(payment.amount)} bold />
          <Row label="Payment Mode" value={payment.payment_mode.replace('_', ' ')} />
          <Row label="Reference No." value={payment.reference_number ?? '-'} />
          <Row label="Current Outstanding" value={formatCurrency(currentOutstanding)} />
        </div>

        {receipt.status === 'CANCELLED' && (
          <div className="mt-6 rounded-md bg-red-50 p-4 text-sm text-red-800">
            <p className="font-semibold">This receipt has been cancelled.</p>
            <p>Reason: {receipt.cancellation_reason}</p>
            <p>Cancelled at: {formatDateTime(receipt.cancelled_at)}</p>
          </div>
        )}

        <div className="mt-6 text-xs text-slate-400">
          Google Drive backup status: <Badge status={receipt.pdf_status} />
        </div>
      </div>

      {showCancel && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="mb-2 text-lg font-semibold">Cancel Receipt {receipt.receipt_number}</h2>
            <p className="mb-4 text-sm text-slate-500">
              This cannot be undone. The receipt number will never be reused, and the payment will be reversed from the student&apos;s
              outstanding balance.
            </p>
            <form onSubmit={submitCancel} className="space-y-3">
              <div>
                <label className="label">Reason for cancellation *</label>
                <textarea className="input" required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              {cancelError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{cancelError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowCancel(false)}>
                  Keep Receipt
                </button>
                <button type="submit" disabled={cancelling} className="btn-danger">
                  {cancelling ? 'Cancelling…' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-medium text-slate-800">{value || '-'}</p>
    </div>
  );
}
function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={bold ? 'font-semibold text-slate-900' : 'text-slate-800'}>{value}</span>
    </div>
  );
}
