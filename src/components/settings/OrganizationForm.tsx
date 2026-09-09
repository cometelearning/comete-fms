'use client';

import { useState } from 'react';

export function OrganizationForm({ initial }: { initial: { name: string; address: string | null; phone: string | null; email: string | null } }) {
  const [form, setForm] = useState({
    name: initial.name,
    address: initial.address ?? '',
    phone: initial.phone ?? '',
    email: initial.email ?? ''
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/organization', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not save.');
        return;
      }
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <h2 className="font-semibold text-slate-800">Organization Details</h2>
      <p className="text-xs text-slate-400">Shown on every receipt.</p>
      <div>
        <label className="label">Name</label>
        <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <label className="label">Address</label>
        <textarea className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      </div>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save'}
        </button>
        {savedAt && <span className="text-xs text-emerald-600">Saved.</span>}
      </div>
    </form>
  );
}
