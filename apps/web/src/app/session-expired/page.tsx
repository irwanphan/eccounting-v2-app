import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SessionExpiredPageClient } from './session-expired-page-client';

export const metadata: Metadata = {
  title: 'Sesi Berakhir',
};

export default function SessionExpiredPage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          Memuat…
        </div>
      }
    >
      <SessionExpiredPageClient />
    </Suspense>
  );
}
