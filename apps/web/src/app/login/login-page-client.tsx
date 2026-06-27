'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { isAuthenticated } from '@/lib/auth-store';

interface LoginPageClientProps {
  children: ReactNode;
}

export function LoginPageClient({ children }: LoginPageClientProps): JSX.Element {
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/companies');
    }
  }, [router]);

  return <>{children}</>;
}
