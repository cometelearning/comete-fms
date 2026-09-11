'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Deactivate/Activate + permanent delete, migration 0019 - both restricted
 * to Super Admin per explicit user request. This component is only ever
 * rendered by the student profile page (src/app/(app)/students/[id]/page.tsx)
 * when session.role.key === 'super_admin', but that's a UI convenience only:
 * every one of these actions is re-checked server-side (API route + RPC +
 * RLS), so hiding the button here is not what actually enforces the
 * restriction.
 */
export function StudentDangerZone({
  studentId,
  studentName,
  status
}: {
  studentId: string;
  studentName: string;
  status: 'ACTIVE' | 'INACTIVE';
}) {
  const router = useRouter();
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [showDelete, setShowDelete] = useState(false);
  const [reason, setReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function toggleStatus() {
    const nextStatus = status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (nextStatus === 'INACTIVE' && !window.confirm(`Deactivate ${studentName}? They will remain in the system with all records intact.`)) {
      return;
    }
    setStatusSaving(true);
    setStatusError(null);
    try {
      const res = await fetch(`/api/students/${studentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const body = await res.json();
      if (!res.ok) {
        setStatusError(body.message ?? 'Could not update status.');
        return;
      }
      router.refresh();
    } finally {
      setStatusSaving(false);
    }
  }

  async function submitDelete(e: React.FormEvent) {
    e.preventDefault();
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const body = await res.json();
      if (!res.ok) {
        setDeleteError(body.message ?? 'Could not delete this student.');
        return;
      }
      router.push('/students');
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="card border-red-100 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-red-700">Super Admin Actions</p>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-secondary" onClick={toggleStatus} disabled={statusSaving}>
          {statusSaving ? 'Saving…' : status === 'ACTIVE' ? 'Deactivate Student' : 'Activate Student'}
        </button>
        <button className="btn-danger" onClick={() => setShowDelete(true)}>
          Delete Permanently
        </button>
      </div>
      {statusError && <p className="mt-2 text-sm text-red-700">{statusError}</p>}

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="mb-2 text-lg font-semibold">Permanently Delete {studentName}?</h2>
            <p className="mb-4 text-sm text-slate-500">
              This cannot be undone and removes the student record entirely - unlike Deactivate, which keeps everything and can be reversed. Only
              allowed when this student has no fee account, payment or receipt on record; if they do, deactivate instead.
            </p>
            <form onSubmit={submitDelete} className="space-y-3">
              <div>
                <label className="label">Reason for deletion *</label>
                <textarea className="input" required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              {deleteError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowDelete(false);
                    setDeleteError(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" disabled={deleting} className="btn-danger">
                  {deleting ? 'Deleting…' : 'Confirm Permanent Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
