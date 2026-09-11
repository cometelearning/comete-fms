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
  children?: NavItem[];
}

// "Masters" bundles the setup screens (Academic Year / Branch / Class /
// Course / Batch / Fee Head) that a fee structure depends on. These are deliberately grouped
// under one entry rather than added as separate top-level items, per the
// spec's "keep navigation clean, no unnecessary items" instruction - but
// each one is a real, permission-gated CRUD page (masters.read/write),
// they just need to be reachable to actually use the app end-to-end.
const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', permission: 'dashboard.view' },
  { href: '/students', label: 'Students', permission: 'students.read' },
  {
    href: '/academic-years',
    label: 'Masters',
    permission: 'masters.read',
    children: [
      { href: '/academic-years', label: 'Academic Years', permission: 'masters.read' },
      { href: '/branches', label: 'Branches', permission: 'masters.read' },
      { href: '/classes', label: 'Classes', permission: 'masters.read' },
      { href: '/courses', label: 'Courses', permission: 'masters.read' },
      { href: '/batches', label: 'Batches', permission: 'masters.read' },
      { href: '/fee-heads', label: 'Fee Heads', permission: 'masters.read' }
    ]
  },
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
  const items = NAV_ITEMS.filter((i) => !i.permission || permSet.has(i.permission)).map((i) => ({
    ...i,
    children: i.children?.filter((c) => !c.permission || permSet.has(c.permission))
  }));
  const isWithin = (href: string) => pathname === href || pathname?.startsWith(href + '/');
  const [mastersOpen, setMastersOpen] = useState(() =>
    ['/academic-years', '/branches', '/classes', '/courses', '/batches', '/fee-heads'].some((h) => isWithin(h))
  );

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
            if (item.children && item.children.length > 0) {
              const groupActive = item.children.some((c) => isWithin(c.href));
              return (
                <div key={item.label}>
                  <button
                    type="button"
                    onClick={() => setMastersOpen((v) => !v)}
                    aria-expanded={mastersOpen}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium ${
                      groupActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                    <ChevronIcon open={mastersOpen} />
                  </button>
                  {mastersOpen && (
                    <div className="ml-3 mt-1 flex flex-col gap-1 border-l border-slate-100 pl-3">
                      {item.children.map((child) => {
                        const active = isWithin(child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setMobileOpen(false)}
                            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                              active ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const active = isWithin(item.href);
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
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`transition-transform ${open ? 'rotate-90' : ''}`}
    >
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
