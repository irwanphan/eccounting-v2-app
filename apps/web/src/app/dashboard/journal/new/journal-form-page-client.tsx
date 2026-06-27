'use client';

import { RequireAuth } from '@/components/require-auth';
import { RequireCompany } from '@/components/require-company';
import { DrawerLayout } from '@/components/drawer-layout';
import { JournalFormPage } from '@/components/journal/journal-form-page';

export function JournalFormPageClient(): JSX.Element {
  return (
    <RequireAuth>
      <RequireCompany>
        <DrawerLayout title="Jurnal Umum" backHref="/dashboard">
          <JournalFormPage />
        </DrawerLayout>
      </RequireCompany>
    </RequireAuth>
  );
}
