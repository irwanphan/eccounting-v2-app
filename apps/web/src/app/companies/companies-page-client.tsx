'use client';

import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import {
  ClientListPage,
  fetchCompanies,
  getCompaniesErrorMessage,
  type CompanyListItem,
} from '@/components/companies/client-list-page';
import { DrawerLayout } from '@/components/drawer-layout';
import { RequireAuth } from '@/components/require-auth';

export function CompaniesPageClient(): JSX.Element {
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createFormOpen, setCreateFormOpen] = useState(false);

  const loadCompanies = useCallback(async () => {
    const rows = await fetchCompanies();
    setCompanies(rows);
  }, []);

  useEffect(() => {
    fetchCompanies()
      .then(setCompanies)
      .catch((err) => setError(getCompaniesErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  async function handleRefresh(): Promise<void> {
    await loadCompanies();
  }

  return (
    <RequireAuth>
      <DrawerLayout
        title="Klien"
        headerActions={
          <button
            type="button"
            onClick={() => setCreateFormOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-600"
          >
            <Plus className="h-4 w-4" />
            Baru
          </button>
        }
      >
        {loading && (
          <p className="text-sm text-muted-foreground">Memuat daftar klien…</p>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-white p-4 text-sm text-destructive shadow-sm">
            {error}
            <p className="mt-2 text-xs text-muted-foreground">
              Pastikan sudah menjalankan <code>pnpm db:migrate</code> dan{' '}
              <code>pnpm db:bootstrap-from-v1</code>.
            </p>
          </div>
        )}

        {!loading && !error && (
          <ClientListPage
            companies={companies}
            onRefresh={handleRefresh}
            createFormOpen={createFormOpen}
            onCreateFormOpenChange={setCreateFormOpen}
          />
        )}
      </DrawerLayout>
    </RequireAuth>
  );
}
