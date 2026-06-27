'use client';

import { RequireAuth } from '@/components/require-auth';
import { RequireCompany } from '@/components/require-company';
import { DrawerLayout } from '@/components/drawer-layout';
import { TrialBalancePage } from '@/components/financial-reports/trial-balance-page';

export function TrialBalancePageClient(): JSX.Element {
  return (
    <RequireAuth>
      <RequireCompany>
        <DrawerLayout title="Neraca Saldo" backHref="/financial-reports">
          <TrialBalancePage />
        </DrawerLayout>
      </RequireCompany>
    </RequireAuth>
  );
}
