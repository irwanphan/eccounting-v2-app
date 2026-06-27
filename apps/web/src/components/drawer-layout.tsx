'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MoreHorizontal, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

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

interface DrawerLayoutProps {
  /** Judul halaman (uppercase di UI) */
  title: string;
  /** Tombol aksi di header (Import CSV, Baru, dll.) */
  headerActions?: ReactNode;
  children: ReactNode;
}

const ADMIN_NAV: NavItem[] = [
  { href: '/companies', label: 'Klien' },
  { href: '#', label: 'Pengguna', disabled: true },
];

/** v1: .nav-item { display: table } — lebar mengikuti teks, tepi kanan tidak sejajar */
function DrawerNavItem({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
}): JSX.Element {
  const className = cn(
    'mb-1 inline-block w-fit whitespace-nowrap border-r-8 border-[#8ec5fb] bg-[#44a0f8] py-0 pl-6 pr-4',
    'text-base font-normal capitalize leading-[44px] text-white shadow-md transition duration-300',
    'hover:border-[#ffd41a] focus:border-[#ffd41a] active:border-[#ffde4d]',
    item.disabled && 'cursor-not-allowed opacity-80 hover:border-[#8ec5fb]',
    active && 'border-[#ffd41a]',
  );

  if (item.disabled) {
    return <span className={className}>{item.label}</span>;
  }

  return (
    <Link href={item.href} className={className} onClick={onNavigate}>
      {item.label}
    </Link>
  );
}

export function DrawerLayout({ title, headerActions, children }: DrawerLayoutProps): JSX.Element {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const selected = getSelectedCompany();

  function closeDrawer(): void {
    setOpen(false);
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#c5e3f6]">
      {/* Toggle — kuning bulat, setara v1 label[for=drawer] */}
      <button
        type="button"
        aria-label={open ? 'Tutup menu' : 'Buka menu'}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'fixed z-[77] flex h-16 w-16 items-center justify-center rounded-full shadow-md transition-all duration-300',
          open ? 'bg-[#75b9fa] text-black left-4 top-4' 
               : 'bg-[#ffd000] text-[#2e2e2e] hover:bg-[#75b9fa] -left-4 -top-4',
        )}
      >
        {open ? <X className="h-8 w-8" /> : <MoreHorizontal className="h-8 w-8" />}
      </button>

      {/* Overlay */}
      {open && (
        <button
          type="button"
          aria-label="Tutup menu"
          className="fixed inset-0 z-[7] bg-black/5"
          onClick={closeDrawer}
        />
      )}

      {/* Nav drawer — hidden until toggle; items-start = lebar per teks seperti v1 */}
      <nav
        className={cn(
          'fixed z-[77] flex flex-col items-start transition-all duration-300',
          open ? 'left-0 top-24 translate-x-0 opacity-100' : 'pointer-events-none left-0 top-24 -translate-x-full opacity-0',
        )}
      >
        {FEATURE_NAV.map((item) => (
          <DrawerNavItem
            key={item.label}
            item={item}
            active={pathname === item.href}
            onNavigate={closeDrawer}
          />
        ))}

        <div className="my-3 h-px w-8 bg-white/30" aria-hidden />

        {ADMIN_NAV.map((item) => (
          <DrawerNavItem
            key={item.label}
            item={item}
            active={pathname === item.href}
            onNavigate={closeDrawer}
          />
        ))}

        <div className="my-3 h-px w-8 bg-white/30" aria-hidden />

        <button
          type="button"
          onClick={() => {
            closeDrawer();
            logout();
          }}
          className="mb-1 inline-block w-fit whitespace-nowrap border-r-8 border-[#8ec5fb] bg-[#44a0f8] py-0 pl-6 pr-4 text-left text-base font-normal capitalize leading-[44px] text-white shadow-md transition hover:border-[#ffd41a] focus:border-[#ffd41a] active:border-[#ffde4d]"
        >
          Logout
        </button>
      </nav>

      {/* Main content — geser saat drawer terbuka (setara v1) */}
      <div
        className={cn(
          'min-h-screen transition-all duration-300',
          open ? 'ml-[200px] mt-[72px]' : 'ml-0 mt-0',
        )}
      >
        {/* Page header — setara v1 page_header */}
        <header className="flex flex-wrap items-center gap-3 px-6 pb-4 pt-6">
          <h1 className="text-lg font-semibold uppercase tracking-wide text-slate-700">{title}</h1>
          {headerActions}
          <div className="ml-auto flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm shadow-sm">
            <span className="font-medium">{selected?.name ?? '—'}</span>
          </div>
        </header>

        <main className="px-6 pb-8">{children}</main>
      </div>
    </div>
  );
}
