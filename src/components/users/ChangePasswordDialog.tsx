'use client';

import { useState } from 'react';

/**
 * Self-service "change my password" (migration 0018), reachable from every
 * page via the sidebar footer - distinct from the admin-side reset on the
 * Users tab, which is for when someone else needs to reset your password
 * for you. See POST /api/auth/change-password for why the current password
 * is still required even though the request is already authenticated.
 */
export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function reset() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirm('');
    setError(null);
    setDone(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not change your password.');
        return;
      }
      setDone(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="btn-ghost mt-1 w-full justify-start px-0 text-sm text-slate-600 hover:bg-transparent"
      >
        Change password
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-sm p-6">
            <h2 className="mb-4 text-lg font-semibold">Change Password</h2>
            {done ? (
              <div className="space-y-4">
                <p className="text-sm text-emerald-700">Your password has been changed.</p>
                <button className="btn-primary w-full" onClick={() => setOpen(false)}>
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="label">Current password</label>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    className="input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">New password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Confirm new password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="input"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
                {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? 'Saving…' : 'Change Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
