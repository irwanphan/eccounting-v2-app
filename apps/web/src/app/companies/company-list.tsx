'use client';

import { ArrowLeftRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ApiError, apiFetch } from '@/lib/api-client';
import { saveSelectedCompany } from '@/lib/company-store';
import { cn } from '@/lib/utils';

export interface CompanyListItem {
  id: string;
  name: string;
  address: string | null;
  legacyV1ClientId: string | null;
}

interface CompanyListProps {
  initialCompanies: CompanyListItem[];
}

export function CompanyList({ initialCompanies }: CompanyListProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<CompanyListItem | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initialCompanies;
    return initialCompanies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.address?.toLowerCase().includes(q) ?? false) ||
        (c.legacyV1ClientId?.includes(q) ?? false),
    );
  }, [initialCompanies, query]);

  function confirmSelect(): void {
    if (!pending) return;
    saveSelectedCompany({
      id: pending.id,
      name: pending.name,
      legacyV1ClientId: pending.legacyV1ClientId,
    });
    // v1: setToManage → redirect group-journal.index
    window.location.href = '/dashboard';
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Menampilkan {filtered.length} dari {initialCompanies.length} klien
        </p>
        <label className="relative block w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Cari nama / alamat / v1 id…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {filtered.map((company) => (
          <li
            key={company.id}
            className="flex items-start justify-between gap-4 px-4 py-4 hover:bg-muted/40"
          >
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{company.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {company.address?.trim() || '—'}
              </p>
              {company.legacyV1ClientId && (
                <p className="mt-1 text-xs text-muted-foreground">
                  v1 client #{company.legacyV1ClientId}
                </p>
              )}
            </div>
            <button
              type="button"
              title="Pilih klien"
              onClick={() => setPending(company)}
              className={cn(
                'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                'bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-600',
              )}
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            Tidak ada klien yang cocok.
          </li>
        )}
      </ul>

      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold uppercase tracking-wide">Konfirmasi Pilih Klien</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Pilih klien <strong className="text-foreground">{pending.name}</strong> untuk dikelola?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
              >
                Tidak
              </button>
              <button
                type="button"
                onClick={confirmSelect}
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
              >
                Ya
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export async function fetchCompanies(): Promise<CompanyListItem[]> {
  const rows = await apiFetch<Array<Record<string, unknown>>>('/companies');
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    address: row.address ? String(row.address) : null,
    legacyV1ClientId: row.legacyV1ClientId ? String(row.legacyV1ClientId) : null,
  }));
}

export function getCompaniesErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Gagal memuat daftar klien.';
}
