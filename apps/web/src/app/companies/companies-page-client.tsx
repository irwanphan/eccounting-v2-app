'use client';

import { useEffect, useState } from 'react';

import { RequireAuth } from '@/components/require-auth';
import {
  CompanyList,
  fetchCompanies,
  getCompaniesErrorMessage,
  type CompanyListItem,
} from './company-list';

export function CompaniesPageClient(): JSX.Element {
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCompanies()
      .then(setCompanies)
      .catch((err) => setError(getCompaniesErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <RequireAuth>
      <div className="min-h-screen bg-slate-100">
        <div className="mx-auto max-w-3xl p-6">
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <header className="mb-6 flex items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <h1 className="text-xl font-semibold uppercase tracking-wide text-slate-700">
                  Daftar Klien
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pilih klien terlebih dahulu — sama seperti v1 <code>/admin/client</code>
                </p>
              </div>
            </header>

            {loading && (
              <p className="text-sm text-muted-foreground">Memuat daftar klien…</p>
            )}
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
                <p className="mt-2 text-xs">
                  Pastikan sudah menjalankan <code>pnpm db:migrate</code> dan{' '}
                  <code>pnpm db:bootstrap-from-v1</code>.
                </p>
              </div>
            )}
            {!loading && !error && <CompanyList initialCompanies={companies} />}
          </div>
        </div>
      </div>
    </RequireAuth>
  );
}
