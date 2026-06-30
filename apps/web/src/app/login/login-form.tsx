'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@eccounting/shared';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';

import { saveAuthTokens } from '@/lib/auth-store';
import { ApiError, apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export function LoginForm(): JSX.Element {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Memuat…</p>}>
      <LoginFormInner />
    </Suspense>
  );
}

function LoginFormInner(): JSX.Element {
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get('expired') === '1';
  const returnTo = searchParams.get('returnTo');
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginInput): Promise<void> {
    setServerError(null);
    try {
      const result = await apiFetch<LoginResponse>('/auth/login', { method: 'POST', body: values });
      saveAuthTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      const safeReturn =
        returnTo && returnTo.startsWith('/') && !returnTo.startsWith('/login')
          ? returnTo
          : '/companies';
      window.location.href = safeReturn;
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Terjadi kesalahan tidak terduga.');
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        Masuk di bawah ini
      </p>

      <div className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-medium text-slate-500">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="E-mail"
            className={cn(
              'w-full border-0 border-b border-slate-300 bg-transparent px-0 py-2 text-sm text-slate-900',
              'placeholder:text-slate-400 focus:border-[#22A7F0] focus:outline-none focus:ring-0',
              errors.email && 'border-destructive focus:border-destructive',
            )}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-medium text-slate-500">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            className={cn(
              'w-full border-0 border-b border-slate-300 bg-transparent px-0 py-2 text-sm text-slate-900',
              'placeholder:text-slate-400 focus:border-[#22A7F0] focus:outline-none focus:ring-0',
              errors.password && 'border-destructive focus:border-destructive',
            )}
            {...register('password')}
          />
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>
      </div>

      {sessionExpired && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Sesi Anda telah berakhir. Silakan login ulang untuk melanjutkan.
        </div>
      )}

      {serverError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          'inline-flex min-w-[9rem] items-center justify-center rounded-sm bg-[#22A7F0] px-6 py-2.5',
          'text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-sm',
          'transition hover:bg-[#1a96db] disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        {isSubmitting ? 'Memproses…' : 'Login'}
      </button>

      <p className="text-xs text-slate-400">
        Tidak punya akun? Hubungi admin firma kamu.
      </p>
    </form>
  );
}
