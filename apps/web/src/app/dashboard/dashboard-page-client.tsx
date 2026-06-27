'use client';

import { RequireAuth } from '@/components/require-auth';
import { RequireCompany } from '@/components/require-company';
import { DrawerLayout } from '@/components/drawer-layout';
import { JournalListPage } from '@/components/journal/journal-list-page';

export function DashboardPageClient(): JSX.Element {
  return (
    <RequireAuth>
      <RequireCompany>
        <DrawerLayout
          title="Daftar Jurnal"
          headerActions={
            <>
              <button
                type="button"
                disabled
                title="Menyusul"
                className="cursor-not-allowed rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground opacity-60"
              >
                Import CSV
              </button>
              <button
                type="button"
                disabled
                title="Menyusul"
                className="cursor-not-allowed rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white opacity-60"
              >
                Baru
              </button>
            </>
          }
        >
          <JournalListPage />
        </DrawerLayout>
      </RequireCompany>
    </RequireAuth>
  );
}
