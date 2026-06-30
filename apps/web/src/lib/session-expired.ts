import type { ErrorCodeValue } from '@eccounting/shared';

import { clearAuthTokens } from './auth-store';
import { clearSelectedCompany } from './company-store';

const SESSION_EXPIRED_CODES: ReadonlySet<ErrorCodeValue> = new Set([
  'AUTH_TOKEN_EXPIRED',
  'AUTH_TOKEN_INVALID',
  'AUTH_REFRESH_TOKEN_INVALID',
  'AUTH_REFRESH_TOKEN_REVOKED',
  'AUTH_REFRESH_TOKEN_REUSED',
]);

let redirecting = false;

export function isSessionExpiredCode(code: ErrorCodeValue | 'UNKNOWN' | undefined): boolean {
  return code !== undefined && code !== 'UNKNOWN' && SESSION_EXPIRED_CODES.has(code);
}

export function shouldHandleAsSessionExpired(
  status: number,
  code: ErrorCodeValue | 'UNKNOWN' | undefined,
  hadAuthToken: boolean,
): boolean {
  if (status !== 401) return false;
  if (isSessionExpiredCode(code)) return true;
  return hadAuthToken && code !== 'AUTH_INVALID_CREDENTIALS';
}

/**
 * Bersihkan sesi lokal dan pindah ke halaman transisi (bukan halaman dalam aplikasi).
 */
export function redirectToSessionExpired(): void {
  if (typeof window === 'undefined' || redirecting) return;
  redirecting = true;

  clearAuthTokens();
  clearSelectedCompany();

  const { pathname, search } = window.location;
  const params = new URLSearchParams();
  const currentPath = `${pathname}${search}`;
  if (currentPath && currentPath !== '/session-expired' && currentPath !== '/login') {
    params.set('returnTo', currentPath);
  }

  const query = params.toString();
  window.location.replace(query ? `/session-expired?${query}` : '/session-expired');
}

/** Cegah caller menampilkan error inline saat redirect sedang berjalan. */
export function waitForSessionRedirect(): Promise<never> {
  return new Promise(() => {});
}
