const ACCESS_TOKEN_KEY = 'eccounting.accessToken';
const REFRESH_TOKEN_KEY = 'eccounting.refreshToken';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

function assertBrowser(): void {
  if (typeof window === 'undefined') {
    throw new Error('auth-store hanya bisa dipakai di browser');
  }
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function saveAuthTokens(tokens: AuthTokens): void {
  assertBrowser();
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearAuthTokens(): void {
  assertBrowser();
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}
