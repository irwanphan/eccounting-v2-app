'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { isAuthenticated } from '@/lib/auth-store';

export default function HomePage(): JSX.Element {
  const router = useRouter();

  useEffect(() => {
    router.replace(isAuthenticated() ? '/companies' : '/login');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Memuat…
    </div>
  );
}
