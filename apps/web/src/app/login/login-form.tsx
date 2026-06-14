'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@eccounting/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { ApiError, apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export function LoginForm(): JSX.Element {
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
      await apiFetch<LoginResponse>('/auth/login', { method: 'POST', body: values });
      window.location.href = '/dashboard';
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Terjadi kesalahan tidak terduga.');
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className={cn(
            'w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
            'focus:outline-none focus:ring-2 focus:ring-ring',
            errors.email && 'border-destructive focus:ring-destructive',
          )}
          {...register('email')}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className={cn(
            'w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
            'focus:outline-none focus:ring-2 focus:ring-ring',
            errors.password && 'border-destructive focus:ring-destructive',
          )}
          {...register('password')}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      {serverError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          'w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm',
          'transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {isSubmitting ? 'Memproses…' : 'Masuk'}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Tidak punya akun? Hubungi admin firma kamu.
      </p>
    </form>
  );
}
