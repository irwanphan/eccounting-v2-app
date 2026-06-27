import type { Metadata } from 'next';

import { CompaniesPageClient } from './companies-page-client';

export const metadata: Metadata = {
  title: 'Daftar Klien',
};

export default function CompaniesPage(): JSX.Element {
  return <CompaniesPageClient />;
}
