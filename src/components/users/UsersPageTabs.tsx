'use client';

import { useState } from 'react';
import { UsersManager } from '@/components/users/UsersManager';
import { RolesManager } from '@/components/users/RolesManager';

interface RoleOption {
  id: string;
  name: string;
}

/**
 * Users tab has two views sharing one nav entry (per "keep navigation
 * clean, no unnecessary items") rather than a separate top-level "Roles"
 * page: Users (accounts, per-user password reset) and Roles & Permissions
 * (add/rename/delete a role, tick which permissions each one grants).
 */
export function UsersPageTabs({ roles, currentUserId }: { roles: RoleOption[]; currentUserId: string }) {
  const [tab, setTab] = useState<'users' | 'roles'>('users');

  return (
    <div>
      <div className="mb-6 flex items-center gap-1 border-b border-slate-200">
        <button
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            tab === 'users' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setTab('users')}
        >
          Users
        </button>
        <button
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            tab === 'roles' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setTab('roles')}
        >
          Roles & Permissions
        </button>
      </div>

      {tab === 'users' ? <UsersManager roles={roles} currentUserId={currentUserId} /> : <RolesManager />}
    </div>
  );
}
