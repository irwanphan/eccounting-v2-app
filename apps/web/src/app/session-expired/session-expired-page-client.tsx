'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';

import { LoginLayout } from '@/components/auth/login-layout';

export function SessionExpiredPageClient(): JSX.Element {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  const loginHref = useMemo(() => {
    const params = new URLSearchParams({ expired: '1' });
    if (returnTo) params.set('returnTo', returnTo);
    return `/login?${params.toString()}`;
  }, [returnTo]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.replace(loginHref);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [loginHref]);

  return (
    <main className="min-h-screen">
      <LoginLayout>
        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Sesi berakhir
          </p>

          <div className="space-y-3">
            <h1 className="text-xl font-semibold text-slate-900">Silakan login ulang</h1>
            <p className="text-sm text-slate-600">
              Sesi Anda telah berakhir demi keamanan. Anda tidak lagi berada di halaman aplikasi
              sebelumnya.
            </p>
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Anda akan dialihkan ke halaman login dalam 5 detik.
          </div>

          <Link
            href={loginHref}
            className="inline-flex min-w-[9rem] items-center justify-center rounded-sm bg-[#22A7F0] px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-sm transition hover:bg-[#1a96db]"
          >
            Login ulang
          </Link>
        </div>
      </LoginLayout>
    </main>
  );
}
