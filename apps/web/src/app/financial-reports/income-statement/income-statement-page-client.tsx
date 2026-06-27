'use client';

import { RequireAuth } from '@/components/require-auth';
import { RequireCompany } from '@/components/require-company';
import { DrawerLayout } from '@/components/drawer-layout';
import { IncomeStatementPage } from '@/components/financial-reports/income-statement-page';

export function IncomeStatementPageClient(): JSX.Element {
  return (
    <RequireAuth>
      <RequireCompany>
        <DrawerLayout title="Laporan Laba Rugi" backHref="/financial-reports">
          <IncomeStatementPage />
        </DrawerLayout>
      </RequireCompany>
    </RequireAuth>
  );
}
