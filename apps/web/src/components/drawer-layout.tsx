'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, MoreHorizontal, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { SelectedCompanyBadge } from '@/components/selected-company-badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { hasSelectedCompany } from '@/lib/company-store';
import { logout } from '@/lib/logout';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  disabled?: boolean;
}

const FEATURE_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Jurnal' },
  { href: '/financial-reports', label: 'Laporan Keuangan' },
  { href: '/accounts', label: 'Kode Akun' },
  { href: '#', label: 'Kas', disabled: true },
];

function isNavActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  if (href === '/financial-reports') return pathname.startsWith('/financial-reports');
  if (href === '/accounts') return pathname.startsWith('/accounts');
  if (href === '/companies') return pathname.startsWith('/companies');
  if (href === '/users') return pathname.startsWith('/users');
  return pathname === href;
}

interface DrawerLayoutProps {
  /** Judul halaman (uppercase di UI) */
  title: string;
  /** Link kembali (setara v1 arrow_back_ios di page-title) */
  backHref?: string;
  /** Tombol aksi di header (Import CSV, Baru, dll.) */
  headerActions?: ReactNode;
  children: ReactNode;
}

const ADMIN_NAV: NavItem[] = [
  { href: '/companies', label: 'Klien' },
  { href: '/users', label: 'Pengguna' },
];

const NO_CLIENT_TOOLTIP = 'Pilih klien terlebih dahulu';
const COMING_SOON_TOOLTIP = 'Menyusul';

/** v1: .nav-item { display: table } — lebar mengikuti teks, tepi kanan tidak sejajar */
function DrawerNavItem({
  item,
  active,
  title,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  title?: string;
  onNavigate: () => void;
}): JSX.Element {
  const className = cn(
    'mb-1 inline-block w-fit whitespace-nowrap border-r-8 border-sky-300 bg-sky-500/80 py-0 pl-6 pr-4',
    'text-base font-normal capitalize leading-[44px] text-white shadow-md transition duration-300',
    'hover:border-yellow-300 focus:border-yellow-300 active:border-yellow-400',
    item.disabled && 'cursor-not-allowed opacity-50 hover:border-sky-300',
    active && !item.disabled && 'border-yellow-400',
  );

  if (item.disabled) {
    return (
      <span className={className} title={title}>
        {item.label}
      </span>
    );
  }

  return (
    <Link href={item.href} className={className} title={title} onClick={onNavigate}>
      {item.label}
    </Link>
  );
}

function resolveFeatureNavItem(
  item: NavItem,
  companySelected: boolean,
): { item: NavItem; title?: string } {
  if (!companySelected) {
    return { item: { ...item, disabled: true }, title: NO_CLIENT_TOOLTIP };
  }
  if (item.disabled) {
    return { item, title: COMING_SOON_TOOLTIP };
  }
  return { item };
}

export function DrawerLayout({
  title,
  backHref,
  headerActions,
  children,
}: DrawerLayoutProps): JSX.Element {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [companySelected, setCompanySelected] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    setCompanySelected(hasSelectedCompany());
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      // Modal/dialog punya prioritas — jangan tutup drawer jika ada dialog terbuka
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      setOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function closeDrawer(): void {
    setOpen(false);
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-sky-200">
      <SelectedCompanyBadge />
      {/* Toggle — kuning bulat, setara v1 label[for=drawer] */}
      <button
        type="button"
        aria-label={open ? 'Tutup menu' : 'Buka menu'}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'fixed z-[77] flex h-16 w-16 items-center justify-center rounded-full shadow-md transition-all duration-300',
          open ? 'bg-sky-400 text-black left-4 top-4' 
               : 'bg-yellow-400 text-slate-800 hover:bg-sky-500 -left-4 -top-4',
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
        {FEATURE_NAV.map((item) => {
          const resolved = resolveFeatureNavItem(item, companySelected);
          return (
            <DrawerNavItem
              key={item.label}
              item={resolved.item}
              title={resolved.title}
              active={isNavActive(pathname, item.href)}
              onNavigate={closeDrawer}
            />
          );
        })}

        <div className="my-3 h-px w-8 bg-white/30" aria-hidden />

        {ADMIN_NAV.map((item) => (
          <DrawerNavItem
            key={item.label}
            item={item}
            title={item.disabled ? COMING_SOON_TOOLTIP : undefined}
            active={isNavActive(pathname, item.href)}
            onNavigate={closeDrawer}
          />
        ))}

        <div className="my-3 h-px w-8 bg-white/30" aria-hidden />

        <button
          type="button"
          onClick={() => {
            closeDrawer();
            setLogoutConfirmOpen(true);
          }}
          className="mb-1 inline-block w-fit whitespace-nowrap border-r-8 border-sky-300 bg-sky-500/80 py-0 pl-6 pr-4 text-left text-base font-normal capitalize leading-[44px] text-white shadow-md transition hover:border-yellow-300 focus:border-yellow-300 active:border-yellow-400"
        >
          Logout
        </button>
      </nav>

      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Logout"
        message="Yakin ingin keluar dari aplikasi?"
        confirmLabel="Logout"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          logout();
        }}
        onCancel={() => setLogoutConfirmOpen(false)}
      />

      {/* Main content — geser saat drawer terbuka (setara v1) */}
      <div
        className={cn(
          'min-h-screen transition-all duration-300',
          open ? 'ml-[200px] mt-[72px]' : 'ml-0 mt-0',
        )}
      >
        {/* Page header — setara v1 page_header */}
        <header className="flex flex-wrap items-center gap-3 px-6 pb-4 pt-6">
          <h1 className="flex items-center gap-2 text-lg font-semibold uppercase tracking-wide text-slate-700 pl-8">
            {backHref && (
              <Link
                href={backHref}
                className="inline-flex rounded-md p-1 text-slate-600 transition hover:bg-white/60 hover:text-slate-900"
                aria-label="Kembali"
              >
                <ChevronLeft className="h-5 w-5" />
              </Link>
            )}
            {title}
          </h1>
          {headerActions}
        </header>

        <main className="px-6 pb-8">{children}</main>
      </div>
    </div>
  );
}
