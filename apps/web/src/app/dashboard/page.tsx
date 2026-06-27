import type { Metadata } from 'next';

import { DashboardPageClient } from './dashboard-page-client';

export const metadata: Metadata = {
  title: 'Jurnal',
};

export default function DashboardPage(): JSX.Element {
  return <DashboardPageClient />;
}
