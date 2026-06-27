const COMPANY_ID_KEY = 'eccounting.selectedCompanyId';
const COMPANY_NAME_KEY = 'eccounting.selectedCompanyName';
const COMPANY_LEGACY_ID_KEY = 'eccounting.selectedCompanyLegacyV1Id';

export interface SelectedCompany {
  id: string;
  name: string;
  legacyV1ClientId?: string | null;
}

function assertBrowser(): void {
  if (typeof window === 'undefined') {
    throw new Error('company-store hanya bisa dipakai di browser');
  }
}

export function getSelectedCompany(): SelectedCompany | null {
  if (typeof window === 'undefined') return null;
  const id = localStorage.getItem(COMPANY_ID_KEY);
  const name = localStorage.getItem(COMPANY_NAME_KEY);
  if (!id || !name) return null;
  return {
    id,
    name,
    legacyV1ClientId: localStorage.getItem(COMPANY_LEGACY_ID_KEY),
  };
}

export function saveSelectedCompany(company: SelectedCompany): void {
  assertBrowser();
  localStorage.setItem(COMPANY_ID_KEY, company.id);
  localStorage.setItem(COMPANY_NAME_KEY, company.name);
  if (company.legacyV1ClientId) {
    localStorage.setItem(COMPANY_LEGACY_ID_KEY, company.legacyV1ClientId);
  } else {
    localStorage.removeItem(COMPANY_LEGACY_ID_KEY);
  }
}

export function clearSelectedCompany(): void {
  assertBrowser();
  localStorage.removeItem(COMPANY_ID_KEY);
  localStorage.removeItem(COMPANY_NAME_KEY);
  localStorage.removeItem(COMPANY_LEGACY_ID_KEY);
}

export function hasSelectedCompany(): boolean {
  return Boolean(getSelectedCompany());
}
