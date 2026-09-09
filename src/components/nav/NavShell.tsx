'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Permission } from '@/lib/types/domain';

interface NavItem {
  href: string;
  label: string;
  permission?: Permission;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', permission: 'dashboard.view' },
  { href: '/students', label: 'Students', permission: 'students.read' },
  { href: '/fee-structures', label: 'Fee Structures', permission: 'fee_structures.read' },
  { href: '/student-fees', label: 'Student Fees', permission: 'student_fees.read' },
  { href: '/collect-fee', label: 'Collect Fee', permission: 'payments.collect' },
  { href: '/receipts', label: 'Receipts', permission: 'receipts.read' },
  { href: '/outstanding', label: 'Outstanding', permission: 'outstanding.view' },
  { href: '/reports', label: 'Reports', permission: 'reports.view' },
  { href: '/users', label: 'Users', permission: 'users.manage' },
  { href: '/settings', label: 'Settings', permission: 'settings.manage' }
];

export function NavShell({
  fullName,
  roleName,
  permissions,
  children
}: {
  fullName: string;
  roleName: string;
  permissions: Permission[];
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const permSet = new Set(permissions);
  const items = NAV_ITEMS.filter((i) => !i.permission || permSet.has(i.permission));

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <button
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
          className="rounded-md border border-slate-200 p-2 text-slate-600"
        >
          <MenuIcon />
        </button>
        <span className="font-semibold text-brand-700">COMETE LEARNING</span>
        <div className="w-9" />
      </div>

      {/* Sidebar (desktop) / drawer (mobile) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 transform border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
          <div>
            <p className="font-bold text-brand-700">COMETE LEARNING</p>
            <p className="text-xs text-slate-400">Fee Management</p>
          </div>
          <button className="lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <CloseIcon />
          </button>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {items.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`rounded-md px-3 py-2 text-sm font-medium ${
                  active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-100 p-4">
          <p className="truncate text-sm font-medium text-slate-800">{fullName}</p>
          <p className="text-xs text-slate-400">{roleName}</p>
          <button onClick={signOut} className="btn-ghost mt-2 w-full justify-start px-0 text-sm text-red-600 hover:bg-transparent">
            Sign out
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
      )}

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
