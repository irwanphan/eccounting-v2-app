'use client';

import { RequireAuth } from '@/components/require-auth';
import { RequireCompany } from '@/components/require-company';
import { DrawerLayout } from '@/components/drawer-layout';
import { GeneralLedgerPage } from '@/components/financial-reports/general-ledger-page';

export function LedgerPageClient(): JSX.Element {
  return (
    <RequireAuth>
      <RequireCompany>
        <DrawerLayout title="Buku Besar" backHref="/financial-reports">
          <GeneralLedgerPage />
        </DrawerLayout>
      </RequireCompany>
    </RequireAuth>
  );
}
