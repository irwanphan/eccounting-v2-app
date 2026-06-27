import { clearAuthTokens } from '@/lib/auth-store';
import { clearSelectedCompany } from '@/lib/company-store';

export function logout(): void {
  clearAuthTokens();
  clearSelectedCompany();
  window.location.href = '/login';
}
