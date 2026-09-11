'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { SubjectDialog } from './SubjectDialog';
import type { FieldOption } from '@/components/masters/MasterCrudPage';

interface SubjectRow {
  id: string;
  name: string;
  status: string;
  subject_classes: { class_id: string; classes: { id: string; name: string } | null }[];
}

export function SubjectsList({ classes, canWrite }: { classes: FieldOption[]; canWrite: boolean }) {
  const [rows, setRows] = useState<SubjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch('/api/subjects')
      .then((r) => r.json())
      .then((d) => setRows(d.data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggleStatus(row: SubjectRow) {
    const nextStatus = row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await fetch(`/api/subjects/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus })
    });
    load();
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Subjects</h1>
          <p className="text-sm text-slate-500">
            Subject master - each subject (e.g. Maths, Science, English) can be tagged to every class it&apos;s taught in.
          </p>
        </div>
        {canWrite && <SubjectDialog mode="create" classes={classes} buttonLabel="+ Add Subject" />}
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No subjects yet. Add one and tag the classes it applies to.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Subject name</th>
                <th>Classes</th>
                <th>Status</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const classIds = r.subject_classes.map((sc) => sc.class_id);
                const classNames = r.subject_classes.map((sc) => sc.classes?.name).filter(Boolean) as string[];
                return (
                  <tr key={r.id}>
                    <td className="font-medium text-slate-900">{r.name}</td>
                    <td className="max-w-md">{classNames.length > 0 ? classNames.join(', ') : '-'}</td>
                    <td>
                      <Badge status={r.status} />
                    </td>
                    {canWrite && (
                      <td className="whitespace-nowrap text-right">
                        <SubjectDialog
                          mode="edit"
                          recordId={r.id}
                          classes={classes}
                          initial={{ name: r.name, class_ids: classIds }}
                          buttonLabel="Edit"
                          buttonClassName="btn-ghost px-2 py-1 text-xs"
                        />
                        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => toggleStatus(r)}>
                          {r.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
