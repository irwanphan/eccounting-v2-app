'use client';

import { useRef, useState } from 'react';

import { ModalShell } from '@/components/ui/modal-shell';
import { ApiError, apiDownload, apiFetch } from '@/lib/api-client';
import { getSelectedCompany } from '@/lib/company-store';
import {
  newDraftLineId,
  saveJournalDraft,
  type JournalDraftLine,
} from '@/lib/journal-draft-store';

interface ImportPreviewLine {
  lineNo: number;
  transactionDate: string;
  accountId: string | null;
  accountCode: string;
  accountName: string | null;
  description: string | null;
  reference: string | null;
  debit: string;
  credit: string;
  warning: string | null;
}

interface JournalImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function JournalImportModal({
  open,
  onClose,
  onImported,
}: JournalImportModalProps): JSX.Element | null {
  const company = getSelectedCompany();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('Belum ada file...');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !company) return null;

  async function handleDownloadTemplate(): Promise<void> {
    await apiDownload(
      `/companies/${company!.id}/journal-entries/import/template`,
      'template import.xlsx',
    );
  }

  async function handleImport(): Promise<void> {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Pilih file Excel terlebih dahulu.');
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiFetch<{ data: ImportPreviewLine[] }>(
        `/companies/${company!.id}/journal-entries/import/preview`,
        { method: 'POST', body: formData },
      );

      const lines: JournalDraftLine[] = res.data.map((row) => ({
        id: newDraftLineId(),
        transactionDate: row.transactionDate,
        accountId: row.accountId,
        accountCode: row.accountCode,
        accountName: row.accountName,
        reference: row.reference ?? '',
        description: row.description ?? '',
        debit: row.debit,
        credit: row.credit,
        warning: row.warning,
      }));

      const postingDate = lines[0]?.transactionDate ?? new Date().toISOString().slice(0, 10);
      saveJournalDraft(company!.id, {
        postingDate,
        note: '',
        source: 'import',
        lines,
      });

      onImported();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memproses file import.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Import CSV"
      titleId="journal-import-title"
    >
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Pilih file</label>
          <div className="mt-2 flex overflow-hidden rounded-md border border-input">
            <label className="cursor-pointer bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600">
              Nama file
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  setFileName(selected?.name ?? 'Belum ada file...');
                  setError(null);
                }}
              />
            </label>
            <span className="flex flex-1 items-center truncate px-3 text-sm text-slate-500">
              {fileName}
            </span>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={importing}
            onClick={() => void handleImport()}
            className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-60"
          >
            {importing ? 'Memproses…' : 'Import'}
          </button>
          <button
            type="button"
            onClick={() => void handleDownloadTemplate()}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
          >
            Unduh Template (.xlsx)
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-orange-400 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
          >
            Batal
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
