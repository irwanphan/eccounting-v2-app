import type { Metadata } from 'next';

import { CompanySettingsPageClient } from './company-settings-page-client';

export const metadata: Metadata = {
  title: 'Pengaturan Klien',
};

interface CompanySettingsPageProps {
  params: Promise<{ id: string }>;
}

export default async function CompanySettingsPage({
  params,
}: CompanySettingsPageProps): Promise<JSX.Element> {
  const { id } = await params;
  return <CompanySettingsPageClient companyId={id} />;
}
