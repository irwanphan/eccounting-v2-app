export interface JournalDraftLine {
  id: string;
  transactionDate: string;
  accountId: string | null;
  accountCode: string;
  accountName: string | null;
  reference: string;
  description: string;
  debit: string;
  credit: string;
  warning?: string | null;
}

export interface JournalDraft {
  postingDate: string;
  note: string;
  source: 'manual' | 'import';
  lines: JournalDraftLine[];
}

function draftKey(companyId: string): string {
  return `eccounting.journalDraft.${companyId}`;
}

function assertBrowser(): void {
  if (typeof window === 'undefined') {
    throw new Error('journal-draft-store hanya bisa dipakai di browser');
  }
}

export function getJournalDraft(companyId: string): JournalDraft | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(draftKey(companyId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as JournalDraft;
  } catch {
    return null;
  }
}

export function saveJournalDraft(companyId: string, draft: JournalDraft): void {
  assertBrowser();
  localStorage.setItem(draftKey(companyId), JSON.stringify(draft));
}

export function clearJournalDraft(companyId: string): void {
  assertBrowser();
  localStorage.removeItem(draftKey(companyId));
}

export function hasJournalDraft(companyId: string): boolean {
  const draft = getJournalDraft(companyId);
  return Boolean(draft && draft.lines.length > 0);
}

export function createEmptyDraft(postingDate: string): JournalDraft {
  return {
    postingDate,
    note: '',
    source: 'manual',
    lines: [],
  };
}

export function newDraftLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function toAmountInput(value: string): string {
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num) || num <= 0) return '';
  return String(num);
}

export function toStoredAmount(value: string): string {
  const cleaned = value.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
  const num = Number.parseFloat(cleaned);
  if (!Number.isFinite(num) || num < 0) return '0.0000';
  return num.toFixed(4);
}
