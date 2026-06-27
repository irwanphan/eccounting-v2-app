'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { getSelectedCompany } from '@/lib/company-store';
import { logout } from '@/lib/logout';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  disabled?: boolean;
}

const FEATURE_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Jurnal' },
  { href: '#', label: 'Laporan Keuangan', disabled: true },
  { href: '#', label: 'Kode Akun', disabled: true },
  { href: '#', label: 'Kas', disabled: true },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/companies', label: 'Klien' },
];

interface AppShellProps {
  title: string;
  children: ReactNode;
}

function NavButton({ item, active }: { item: NavItem; active: boolean }): JSX.Element {
  const className = cn(
    'block w-full rounded-md px-3 py-2 text-left text-sm font-medium transition',
    item.disabled
      ? 'cursor-not-allowed text-muted-foreground/60'
      : active
        ? 'bg-primary text-primary-foreground'
        : 'bg-primary/90 text-primary-foreground hover:bg-primary',
  );

  if (item.disabled) {
    return (
      <span className={className} title="Menyusul">
        {item.label}
      </span>
    );
  }

  return (
    <Link href={item.href} className={className}>
      {item.label}
    </Link>
  );
}

export function AppShell({ title, children }: AppShellProps): JSX.Element {
  const pathname = usePathname();
  const selected = getSelectedCompany();

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl gap-4 p-4">
        <aside className="flex w-52 shrink-0 flex-col gap-3">
          <div className="rounded-lg bg-white p-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Eccounting
            </p>
            {selected && (
              <p className="mt-2 text-sm font-medium leading-snug text-foreground">{selected.name}</p>
            )}
          </div>

          <nav className="flex flex-col gap-2">
            {FEATURE_NAV.map((item) => (
              <NavButton key={item.label} item={item} active={pathname === item.href} />
            ))}
          </nav>

          <nav className="mt-auto flex flex-col gap-2 border-t border-border pt-3">
            {ADMIN_NAV.map((item) => (
              <NavButton key={item.label} item={item} active={pathname === item.href} />
            ))}
            <button
              type="button"
              onClick={logout}
              className="block w-full rounded-md bg-primary/90 px-3 py-2 text-left text-sm font-medium text-primary-foreground transition hover:bg-primary"
            >
              Logout
            </button>
          </nav>
        </aside>

        <main className="flex-1 rounded-lg bg-white p-6 shadow-sm">
          <header className="mb-6 border-b border-border pb-4">
            <h1 className="text-xl font-semibold uppercase tracking-wide text-slate-700">{title}</h1>
            {selected?.legacyV1ClientId && (
              <p className="mt-1 text-xs text-muted-foreground">
                v1 client #{selected.legacyV1ClientId} · v2 company #{selected.id}
              </p>
            )}
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
