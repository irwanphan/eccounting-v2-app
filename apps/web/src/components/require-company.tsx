'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { fetchCompanies } from '@/components/companies/client-list-page';
import { ApiError } from '@/lib/api-client';
import {
  clearSelectedCompany,
  getSelectedCompany,
  hasSelectedCompany,
} from '@/lib/company-store';

interface RequireCompanyProps {
  children: ReactNode;
}

/** Mirror v1 `client_exists` middleware — wajib pilih klien yang user punya aksesnya. */
export function RequireCompany({ children }: RequireCompanyProps): JSX.Element | null {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hasSelectedCompany()) {
      router.replace('/companies');
      return;
    }

    let cancelled = false;

    fetchCompanies()
      .then((rows) => {
        if (cancelled) return;
        const selected = getSelectedCompany();
        const allowed = new Set(rows.map((row) => row.id));
        if (!selected || !allowed.has(selected.id)) {
          clearSelectedCompany();
          router.replace('/companies');
          return;
        }
        setReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
          return;
        }
        clearSelectedCompany();
        router.replace('/companies');
      });

    return () => {
      cancelled = true;
    };
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
