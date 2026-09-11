'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import type { FieldOption } from '@/components/masters/MasterCrudPage';

interface CourseRow {
  id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  class_ids: string[];
}

interface Form {
  name: string;
  description: string;
  class_ids: string[];
}

const emptyForm: Form = { name: '', description: '', class_ids: [] };

// Course Master's own page, not built on the shared MasterCrudPage (unlike
// every other simple master) because a course now links to one or more
// Classes (course_classes, migration 0016) - a many-to-many tag list, which
// MasterCrudPage's single select/text/date/checkbox/textarea field types
// can't express. Everything else (list, Activate/Deactivate, audit trail)
// mirrors MasterCrudPage's behaviour so Course Master still feels
// consistent with the other master pages.
export function CoursesManager({ classes, canWrite }: { classes: FieldOption[]; canWrite: boolean }) {
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CourseRow | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const classNameById = Object.fromEntries(classes.map((c) => [c.value, c.label]));

  async function load() {
    setLoading(true);
    const res = await fetch('/api/courses');
    const data = await res.json();
    setRows(data.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  }

  function openEdit(row: CourseRow) {
    setEditing(row);
    setForm({ name: row.name, description: row.description ?? '', class_ids: row.class_ids });
    setError(null);
    setShowForm(true);
  }

  function toggleClass(classId: string) {
    setForm((f) => ({
      ...f,
      class_ids: f.class_ids.includes(classId) ? f.class_ids.filter((id) => id !== classId) : [...f.class_ids, classId]
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.class_ids.length === 0) {
      setError('Pick at least one Class.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = editing ? `/api/courses/${editing.id}` : '/api/courses';
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

  async function toggleStatus(row: CourseRow) {
    const nextStatus = row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await fetch(`/api/courses/${row.id}`, {
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
          <h1 className="text-xl font-semibold text-slate-900">Courses</h1>
          <p className="text-sm text-slate-500">
            Every course you run, e.g. CA Foundation, Class 12 Commerce. Tag a course with every Class it applies to - the same course
            can be reused across several Classes instead of creating a duplicate per Class. The Add/Edit Student form uses this link to
            only show the courses tagged to the Class picked there.
          </p>
        </div>
        {canWrite && (
          <button className="btn-primary" onClick={openCreate}>
            + Add Course
          </button>
        )}
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No records yet.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Course name</th>
                <th>Classes</th>
                <th>Description</th>
                <th>Status</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>
                    {row.class_ids.length === 0 ? (
                      <span className="text-slate-400">-</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {row.class_ids.map((id) => (
                          <span key={id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                            {classNameById[id] ?? '-'}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>{row.description ?? '-'}</td>
                  <td>
                    <Badge status={row.status} />
                  </td>
                  {canWrite && (
                    <td className="whitespace-nowrap text-right">
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => openEdit(row)}>
                        Edit
                      </button>
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => toggleStatus(row)}>
                        {row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
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
            <h2 className="mb-4 text-lg font-semibold">{editing ? 'Edit Course' : 'Add Course'}</h2>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Course name</label>
                <input className="input" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Classes</label>
                {classes.length === 0 ? (
                  <p className="text-sm text-slate-500">No active classes yet - add one in Class Master first.</p>
                ) : (
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
                    {classes.map((c) => (
                      <label key={c.value} className="flex items-center gap-2 py-0.5 text-sm text-slate-700">
                        <input type="checkbox" checked={form.class_ids.includes(c.value)} onChange={() => toggleClass(c.value)} />
                        {c.label}
                      </label>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-xs text-slate-500">Pick every Class this course applies to. At least one is required.</p>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
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
