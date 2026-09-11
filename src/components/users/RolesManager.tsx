'use client';

import { useEffect, useState } from 'react';

interface PermissionDef {
  key: string;
  description: string;
  category: string;
}

interface RoleRow {
  id: string;
  key: string;
  name: string;
  is_system: boolean;
  permission_keys: string[];
}

/**
 * Users > Roles & Permissions. Lets a Super Admin/Admin (users.manage) add
 * a new role, rename or delete a non-system one, and toggle exactly which
 * permissions each role grants - the app-code half of "Design permissions
 * so additional roles can be added later" (spec #6). No migration was
 * needed for this: `roles`/`permissions`/`role_permissions` and their RLS
 * (migrations 0001/0003) already supported it, this screen is the missing
 * UI. Super Admin's own row is shown read-only (every permission, always) -
 * see the PUT /api/roles/[id]/permissions route for why.
 */
export function RolesManager() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  function load() {
    setLoading(true);
    Promise.all([fetch('/api/roles').then((r) => r.json()), fetch('/api/permissions').then((r) => r.json())])
      .then(([rolesData, permsData]) => {
        setRoles(rolesData.data ?? []);
        setPermissions(permsData.data ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const categories = Array.from(new Set(permissions.map((p) => p.category)));

  async function togglePermission(role: RoleRow, key: string) {
    if (role.key === 'super_admin') return;
    const has = role.permission_keys.includes(key);
    const nextKeys = has ? role.permission_keys.filter((k) => k !== key) : [...role.permission_keys, key];

    // Optimistic update so checking a box feels instant.
    setRoles((rs) => rs.map((r) => (r.id === role.id ? { ...r, permission_keys: nextKeys } : r)));
    setSavingRoleId(role.id);
    setRowError((e) => ({ ...e, [role.id]: '' }));

    const res = await fetch(`/api/roles/${role.id}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission_keys: nextKeys })
    });
    setSavingRoleId(null);
    if (!res.ok) {
      const data = await res.json();
      // Revert on failure.
      setRoles((rs) => rs.map((r) => (r.id === role.id ? role : r)));
      setRowError((e) => ({ ...e, [role.id]: data.message ?? 'Could not save.' }));
    }
  }

  async function addRole(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const res = await fetch('/api/roles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newRoleName }) });
    const data = await res.json();
    if (!res.ok) {
      setAddError(data.message ?? 'Could not create this role.');
      return;
    }
    setShowAdd(false);
    setNewRoleName('');
    load();
  }

  async function saveRename(role: RoleRow) {
    const res = await fetch(`/api/roles/${role.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameValue })
    });
    if (res.ok) {
      setRenamingId(null);
      load();
    }
  }

  async function deleteRole(role: RoleRow) {
    if (!confirm(`Delete the "${role.name}" role? This cannot be undone.`)) return;
    const res = await fetch(`/api/roles/${role.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message ?? 'Could not delete this role.'); // eslint-disable-line no-alert
      return;
    }
    load();
  }

  if (loading) return <p className="p-6 text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Control which screens and actions each role can access. Super Admin always has every permission and can&apos;t be changed.
        </p>
        <button className="btn-primary shrink-0" onClick={() => setShowAdd(true)}>
          + Add Role
        </button>
      </div>

      <div className="space-y-4">
        {roles.map((role) => {
          const locked = role.key === 'super_admin';
          return (
            <div key={role.id} className="card p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {renamingId === role.id ? (
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveRename(role);
                      }}
                    >
                      <input className="input py-1 text-sm" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
                      <button type="submit" className="btn-secondary px-2 py-1 text-xs">
                        Save
                      </button>
                      <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setRenamingId(null)}>
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <>
                      <p className="font-semibold text-slate-800">{role.name}</p>
                      {role.is_system && <span className="badge bg-slate-100 text-slate-600">System</span>}
                    </>
                  )}
                </div>
                {!role.is_system && renamingId !== role.id && (
                  <div className="flex gap-2">
                    <button
                      className="btn-ghost px-2 py-1 text-xs"
                      onClick={() => {
                        setRenamingId(role.id);
                        setRenameValue(role.name);
                      }}
                    >
                      Rename
                    </button>
                    <button className="btn-ghost px-2 py-1 text-xs text-red-600" onClick={() => deleteRole(role)}>
                      Delete
                    </button>
                  </div>
                )}
                {locked && <p className="text-xs text-slate-400">Complete access, always</p>}
                {savingRoleId === role.id && <span className="text-xs text-slate-400">Saving…</span>}
              </div>

              {rowError[role.id] && <p className="mb-2 text-xs text-red-600">{rowError[role.id]}</p>}

              {!locked && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {categories.map((category) => (
                    <div key={category}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{category}</p>
                      <div className="space-y-1">
                        {permissions
                          .filter((p) => p.category === category)
                          .map((p) => (
                            <label key={p.key} className="flex items-start gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={role.permission_keys.includes(p.key)}
                                onChange={() => togglePermission(role, p.key)}
                              />
                              <span>{p.description}</span>
                            </label>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-sm p-6">
            <h2 className="mb-4 text-lg font-semibold">Add Role</h2>
            <form onSubmit={addRole} className="space-y-4">
              <div>
                <label className="label">Role name</label>
                <input className="input" required autoFocus value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="e.g. Front Desk" />
              </div>
              <p className="text-xs text-slate-400">The new role starts with no permissions - tick the boxes you want it to have afterwards.</p>
              {addError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{addError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
