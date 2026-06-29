import type { Metadata } from 'next';

import { UsersPageClient } from './users-page-client';

export const metadata: Metadata = {
  title: 'Daftar Pengguna',
};

export default function UsersPage(): JSX.Element {
  return <UsersPageClient />;
}
