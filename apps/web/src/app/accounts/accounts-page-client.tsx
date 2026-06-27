'use client';

import { RequireAuth } from '@/components/require-auth';
import { RequireCompany } from '@/components/require-company';
import { DrawerLayout } from '@/components/drawer-layout';
import { CoaTreePage } from '@/components/accounts/coa-tree-page';

export function AccountsPageClient(): JSX.Element {
  return (
    <RequireAuth>
      <RequireCompany>
        <DrawerLayout title="Chart of Account">
          <CoaTreePage />
        </DrawerLayout>
      </RequireCompany>
    </RequireAuth>
  );
}
