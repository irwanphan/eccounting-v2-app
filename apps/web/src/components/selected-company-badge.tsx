'use client';

import { LayoutGrid } from 'lucide-react';

import { getSelectedCompany } from '@/lib/company-store';

/** v1: .client-active — fixed kanan atas, nempel saat scroll */
export function SelectedCompanyBadge(): JSX.Element | null {
  const selected = getSelectedCompany();
  if (!selected) return null;

  return (
    <div
      className="fixed right-4 top-0 z-[18] flex max-w-[min(420px,calc(100vw-5rem))] items-center gap-1 rounded-b-xl bg-white px-3 pb-2 pt-1 shadow-md"
      aria-label={`Klien aktif: ${selected.name}`}
    >
      <LayoutGrid className="h-5 w-5 shrink-0 text-sky-500" aria-hidden />
      <span className="truncate text-sm font-medium tracking-wide text-slate-800">{selected.name}</span>
    </div>
  );
}
