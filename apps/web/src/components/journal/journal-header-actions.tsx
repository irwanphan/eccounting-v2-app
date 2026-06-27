'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { JournalDraftConflictModal } from '@/components/journal/journal-draft-conflict-modal';
import { JournalImportModal } from '@/components/journal/journal-import-modal';
import { getSelectedCompany } from '@/lib/company-store';
import {
  clearJournalDraft,
  createEmptyDraft,
  hasJournalDraft,
  saveJournalDraft,
} from '@/lib/journal-draft-store';

export function JournalHeaderActions(): JSX.Element {
  const router = useRouter();
  const company = getSelectedCompany();
  const [importOpen, setImportOpen] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'new' | 'import' | null>(null);

  function openNewJournal(): void {
    if (!company) return;
    if (hasJournalDraft(company.id)) {
      setPendingAction('new');
      setConflictOpen(true);
      return;
    }
    saveJournalDraft(company.id, createEmptyDraft(new Date().toISOString().slice(0, 10)));
    router.push('/dashboard/journal/new');
  }

  function openImport(): void {
    if (!company) return;
    if (hasJournalDraft(company.id)) {
      setPendingAction('import');
      setConflictOpen(true);
      return;
    }
    setImportOpen(true);
  }

  function continueDraft(): void {
    setConflictOpen(false);
    setPendingAction(null);
    router.push('/dashboard/journal/new');
  }

  function discardDraftAndContinue(): void {
    if (!company) return;
    clearJournalDraft(company.id);
    const action = pendingAction;
    setConflictOpen(false);
    setPendingAction(null);
    if (action === 'import') {
      setImportOpen(true);
      return;
    }
    saveJournalDraft(company.id, createEmptyDraft(new Date().toISOString().slice(0, 10)));
    router.push('/dashboard/journal/new');
  }

  return (
    <>
      <button
        type="button"
        onClick={openImport}
        className="rounded-md bg-sky-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-sky-600"
      >
        Import CSV
      </button>
      <button
        type="button"
        onClick={openNewJournal}
        className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-600"
      >
        Baru
      </button>

      <JournalImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setImportOpen(false);
          router.push('/dashboard/journal/new');
        }}
      />

      <JournalDraftConflictModal
        open={conflictOpen}
        mode={pendingAction ?? 'new'}
        onContinue={continueDraft}
        onDiscard={discardDraftAndContinue}
        onCancel={() => {
          setConflictOpen(false);
          setPendingAction(null);
        }}
      />
    </>
  );
}
