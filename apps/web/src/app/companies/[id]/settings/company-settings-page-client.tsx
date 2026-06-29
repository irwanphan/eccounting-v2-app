'use client';

import { CompanySettingsForm } from '@/components/companies/company-settings-form';
import { DrawerLayout } from '@/components/drawer-layout';
import { RequireAuth } from '@/components/require-auth';

interface CompanySettingsPageClientProps {
  companyId: string;
}

export function CompanySettingsPageClient({
  companyId,
}: CompanySettingsPageClientProps): JSX.Element {
  return (
    <RequireAuth>
      <DrawerLayout title="Pengaturan Klien" backHref="/companies">
        <CompanySettingsForm companyId={companyId} />
      </DrawerLayout>
    </RequireAuth>
  );
}
