'use client';

import { RequireAuth } from '@/components/require-auth';
import { RequireCompany } from '@/components/require-company';
import { DrawerLayout } from '@/components/drawer-layout';
import { FinancialReportIndex } from '@/components/financial-reports/financial-report-index';

export function FinancialReportsPageClient(): JSX.Element {
  return (
    <RequireAuth>
      <RequireCompany>
        <DrawerLayout title="Laporan Keuangan">
          <FinancialReportIndex />
        </DrawerLayout>
      </RequireCompany>
    </RequireAuth>
  );
}
