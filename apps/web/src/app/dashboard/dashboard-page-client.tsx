'use client';

import { RequireAuth } from '@/components/require-auth';
import { RequireCompany } from '@/components/require-company';
import { DrawerLayout } from '@/components/drawer-layout';
import { JournalHeaderActions } from '@/components/journal/journal-header-actions';
import { JournalListPage } from '@/components/journal/journal-list-page';

export function DashboardPageClient(): JSX.Element {
  return (
    <RequireAuth>
      <RequireCompany>
        <DrawerLayout title="Daftar Jurnal" headerActions={<JournalHeaderActions />}>
          <JournalListPage />
        </DrawerLayout>
      </RequireCompany>
    </RequireAuth>
  );
}
