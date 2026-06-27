'use client';

import { RequireAuth } from '@/components/require-auth';
import { RequireCompany } from '@/components/require-company';
import { DrawerLayout } from '@/components/drawer-layout';
import { BalanceSheetPage } from '@/components/financial-reports/balance-sheet-page';

export function BalanceSheetPageClient(): JSX.Element {
  return (
    <RequireAuth>
      <RequireCompany>
        <DrawerLayout title="Neraca" backHref="/financial-reports">
          <BalanceSheetPage />
        </DrawerLayout>
      </RequireCompany>
    </RequireAuth>
  );
}
