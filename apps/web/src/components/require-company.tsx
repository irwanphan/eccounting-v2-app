'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { hasSelectedCompany } from '@/lib/company-store';

interface RequireCompanyProps {
  children: ReactNode;
}

/** Mirror v1 `client_exists` middleware — wajib pilih klien dulu. */
export function RequireCompany({ children }: RequireCompanyProps): JSX.Element | null {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hasSelectedCompany()) {
      router.replace('/companies');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Memuat…
      </div>
    );
  }

  return <>{children}</>;
}
