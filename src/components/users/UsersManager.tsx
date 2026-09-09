'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils/format';

interface RoleOption {
  id: string;
  name: string;
}

export function UsersManager({ roles, currentUserId }: { roles: RoleOption[]; currentUserId: string }) {
  const [rows, setRows] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', mobile: '', role_id: roles[0]?.id ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credential, setCredential] = useState<{ email: string; password: string } | null>(null);

  function load() {
    setLoading(true);
    fetch('/api/users')
      .then((r) => r.json())
      .then((d) => setRows(d.data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not create this user.');
        return;
      }
      setCredential({ email: form.email, password: data.data.tempPassword });
      setShowForm(false);
      setForm({ full_name: '', email: '', mobile: '', role_id: roles[0]?.id ?? '' });
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    await fetch(`/api/users/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !row.is_active })
    });
    load();
  }

  async function changeRole(row: any, roleId: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
    await fetch(`/api/users/${row.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role_id: roleId }) });
    load();
  }

  async function resetPassword(row: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const res = await fetch(`/api/users/${row.id}/reset-password`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) setCredential({ email: row.email, password: data.data.tempPassword });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500">Every employee has their own login and role-based permissions.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Add User
        </button>
      </div>

      {credential && (
        <div className="card mb-4 border-l-4 border-l-emerald-500 p-4">
          <p className="text-sm font-semibold text-emerald-800">Account ready. Share these credentials securely - they will not be shown again.</p>
          <p className="mt-1 font-mono text-sm">
            {credential.email} / {credential.password}
          </p>
          <button className="btn-ghost mt-2 px-0 text-xs" onClick={() => setCredential(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Mobile</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium text-slate-900">{r.full_name}</td>
                  <td>{r.email}</td>
                  <td>{r.mobile ?? '-'}</td>
                  <td>
                    <select className="input py-1 text-xs" value={r.role_id} onChange={(e) => changeRole(r, e.target.value)} disabled={r.id === currentUserId}>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <Badge status={r.is_active ? 'ACTIVE' : 'INACTIVE'} />
                  </td>
                  <td>{formatDate(r.created_at)}</td>
                  <td className="whitespace-nowrap text-right">
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => resetPassword(r)}>
                      Reset Password
                    </button>
                    <button className="btn-ghost px-2 py-1 text-xs" disabled={r.id === currentUserId} onClick={() => toggleActive(r)}>
                      {r.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="mb-4 text-lg font-semibold">Add User</h2>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Full name</label>
                <input className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div>
                <label className="label">Email (used to sign in)</label>
                <input type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="label">Mobile</label>
                <input className="input" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="input" value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
