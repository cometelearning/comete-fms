'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';

export interface FieldOption {
  value: string;
  label: string;
}

export interface MasterField {
  name: string;
  label: string;
  type: 'text' | 'date' | 'select' | 'checkbox' | 'textarea';
  required?: boolean;
  options?: FieldOption[];
}

export interface MasterColumn {
  key: string;
  label: string;
  render?: (row: Record<string, any>) => React.ReactNode; // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface Props {
  title: string;
  description?: string;
  apiPath: string;
  fields: MasterField[];
  columns: MasterColumn[];
  hasStatus?: boolean;
  canWrite: boolean;
  emptyLabel?: string;
}

export function MasterCrudPage({ title, description, apiPath, fields, columns, hasStatus = true, canWrite, emptyLabel }: Props) {
  const [rows, setRows] = useState<Record<string, any>[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Record<string, any> | null>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [form, setForm] = useState<Record<string, any>>({}); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(apiPath);
    const data = await res.json();
    setRows(data.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiPath]);

  function openCreate() {
    setEditing(null);
    const initial: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    fields.forEach((f) => (initial[f.name] = f.type === 'checkbox' ? false : ''));
    setForm(initial);
    setError(null);
    setShowForm(true);
  }

  function openEdit(row: Record<string, any>) { // eslint-disable-line @typescript-eslint/no-explicit-any
    setEditing(row);
    const initial: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    fields.forEach((f) => (initial[f.name] = row[f.name] ?? (f.type === 'checkbox' ? false : '')));
    setForm(initial);
    setError(null);
    setShowForm(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const url = editing ? `${apiPath}/${editing.id}` : apiPath;
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not save. Please check the details and try again.');
        return;
      }
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(row: Record<string, any>) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const nextStatus = row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await fetch(`${apiPath}/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus })
    });
    await load();
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </div>
        {canWrite && (
          <button className="btn-primary" onClick={openCreate}>
            + Add {title.replace(/s$/, '')}
          </button>
        )}
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">{emptyLabel ?? 'No records yet.'}</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                {hasStatus && <th>Status</th>}
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((c) => (
                    <td key={c.key}>{c.render ? c.render(row) : (row[c.key] ?? '-')}</td>
                  ))}
                  {hasStatus && (
                    <td>
                      <Badge status={row.status} />
                    </td>
                  )}
                  {canWrite && (
                    <td className="whitespace-nowrap text-right">
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => openEdit(row)}>
                        Edit
                      </button>
                      {hasStatus && (
                        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => toggleStatus(row)}>
                          {row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-lg p-6">
            <h2 className="mb-4 text-lg font-semibold">{editing ? `Edit ${title.replace(/s$/, '')}` : `Add ${title.replace(/s$/, '')}`}</h2>
            <form onSubmit={submit} className="space-y-4">
              {fields.map((f) => (
                <div key={f.name}>
                  {f.type === 'checkbox' ? (
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={!!form[f.name]}
                        onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })}
                      />
                      {f.label}
                    </label>
                  ) : f.type === 'select' ? (
                    <div>
                      <label className="label">{f.label}</label>
                      <select
                        className="input"
                        required={f.required}
                        value={form[f.name] ?? ''}
                        onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      >
                        <option value="">Select…</option>
                        {f.options?.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : f.type === 'textarea' ? (
                    <div>
                      <label className="label">{f.label}</label>
                      <textarea
                        className="input"
                        required={f.required}
                        value={form[f.name] ?? ''}
                        onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="label">{f.label}</label>
                      <input
                        type={f.type}
                        className="input"
                        required={f.required}
                        value={form[f.name] ?? ''}
                        onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              ))}
              {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
