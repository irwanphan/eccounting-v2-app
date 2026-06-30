'use client';

import type { AccountTreeNode, AccountTreeResponse } from '@eccounting/shared';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select';
import { ApiError, apiFetch } from '@/lib/api-client';
import { getSelectedCompany } from '@/lib/company-store';
import {
  clearJournalDraft,
  createEmptyDraft,
  getJournalDraft,
  newDraftLineId,
  saveJournalDraft,
  toStoredAmount,
  type JournalDraft,
  type JournalDraftLine,
} from '@/lib/journal-draft-store';
import { formatIdrAmount } from '@/lib/format-idr';
import { cn } from '@/lib/utils';

function flattenPostableAccounts(nodes: AccountTreeNode[]): SearchableSelectOption[] {
  const options: SearchableSelectOption[] = [];
  function walk(list: AccountTreeNode[], depth = 0): void {
    for (const node of list) {
      if (node.isPostable) {
        options.push({
          value: node.id,
          label: `${node.code} — ${node.name}`,
          searchText: `${node.code} ${node.name}`,
          indent: depth,
        });
      }
      if (node.children.length > 0) walk(node.children, depth + 1);
    }
  }
  walk(nodes);
  return options;
}

function sumAmount(lines: JournalDraftLine[], field: 'debit' | 'credit'): number {
  return lines.reduce((acc, line) => acc + Number.parseFloat(line[field] || '0'), 0);
}

export function JournalFormPage(): JSX.Element {
  const router = useRouter();
  const companyId = getSelectedCompany()?.id ?? null;
  const today = new Date().toISOString().slice(0, 10);

  const [draft, setDraft] = useState<JournalDraft>(() =>
    companyId ? getJournalDraft(companyId) ?? createEmptyDraft(today) : createEmptyDraft(today),
  );
  const [accountOptions, setAccountOptions] = useState<SearchableSelectOption[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lineAccountId, setLineAccountId] = useState('');
  const [lineDate, setLineDate] = useState(today);
  const [lineReference, setLineReference] = useState('');
  const [lineDescription, setLineDescription] = useState('');
  const [lineDebit, setLineDebit] = useState('');
  const [lineCredit, setLineCredit] = useState('');

  useEffect(() => {
    if (!companyId) return;
    saveJournalDraft(companyId, draft);
  }, [companyId, draft]);

  const loadAccounts = useCallback(async (): Promise<void> => {
    if (!companyId) {
      setAccountOptions([]);
      setLoadingAccounts(false);
      return;
    }
    setLoadingAccounts(true);
    try {
      const res = await apiFetch<{ data: AccountTreeResponse }>(
        `/companies/${companyId}/accounts/tree`,
      );
      setAccountOptions(flattenPostableAccounts(res.data.tree));
      setError(null);
    } catch (err) {
      setAccountOptions([]);
      if (err instanceof ApiError) {
        setError(err.message);
      }
    } finally {
      setLoadingAccounts(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const totals = useMemo(
    () => ({
      debit: sumAmount(draft.lines, 'debit'),
      credit: sumAmount(draft.lines, 'credit'),
    }),
    [draft.lines],
  );

  function addLine(): void {
    if (!lineAccountId) {
      setError('Pilih kode akun terlebih dahulu.');
      return;
    }
    const account = accountOptions.find((opt) => opt.value === lineAccountId);
    const debit = toStoredAmount(lineDebit);
    const credit = toStoredAmount(lineCredit);
    if ((debit === '0.0000' && credit === '0.0000') || (debit !== '0.0000' && credit !== '0.0000')) {
      setError('Isi salah satu: debet atau kredit.');
      return;
    }

    const codeName = account?.label.split(' — ') ?? ['', ''];
    const newLine: JournalDraftLine = {
      id: newDraftLineId(),
      transactionDate: lineDate,
      accountId: lineAccountId,
      accountCode: codeName[0] ?? '',
      accountName: codeName[1] ?? null,
      reference: lineReference.trim(),
      description: lineDescription.trim(),
      debit,
      credit,
    };

    setDraft((prev) => ({ ...prev, lines: [...prev.lines, newLine] }));
    setLineReference('');
    setLineDescription('');
    setLineDebit('');
    setLineCredit('');
    setError(null);
  }

  function removeLine(id: string): void {
    setDraft((prev) => ({ ...prev, lines: prev.lines.filter((line) => line.id !== id) }));
  }

  function cancel(): void {
    if (!companyId) return;
    clearJournalDraft(companyId);
    router.push('/dashboard');
  }

  async function save(): Promise<void> {
    if (!companyId) return;
    if (draft.lines.length < 2) {
      setError('Jurnal harus memiliki minimal 2 baris.');
      return;
    }
    if (Math.abs(totals.debit - totals.credit) > 0.0001) {
      setError('Total debet dan kredit harus balance.');
      return;
    }
    if (draft.lines.some((line) => !line.accountId || line.warning)) {
      setError('Perbaiki baris yang memiliki peringatan atau akun kosong.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/companies/${companyId}/journal-entries`, {
        method: 'POST',
        body: {
          postingDate: draft.postingDate,
          transactionDate: draft.lines[0]?.transactionDate ?? draft.postingDate,
          description: draft.note.trim() || undefined,
          source: draft.source,
          lines: draft.lines.map((line) => ({
            accountId: line.accountId!,
            debit: line.debit,
            credit: line.credit,
            reference: line.reference || undefined,
            description: line.description || undefined,
          })),
        },
      });
      clearJournalDraft(companyId);
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan jurnal.');
    } finally {
      setSaving(false);
    }
  }

  if (!companyId) {
    return <p className="text-sm text-muted-foreground">Pilih klien terlebih dahulu.</p>;
  }

  return (
    <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-slate-700">Tanggal Form</span>
          <input
            type="date"
            value={draft.postingDate}
            onChange={(e) => setDraft((prev) => ({ ...prev, postingDate: e.target.value }))}
            className="w-full rounded-md border border-input px-3 py-2 text-sm"
          />
        </label>
        <div className="md:col-span-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-slate-700">Catatan</span>
            <textarea
              rows={3}
              value={draft.note}
              onChange={(e) => setDraft((prev) => ({ ...prev, note: e.target.value }))}
              className="w-full rounded-md border border-input px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-sky-300">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-600">
              <th className="px-3 py-2">No</th>
              <th className="px-3 py-2">Tgl</th>
              <th className="px-3 py-2">Kode</th>
              <th className="px-3 py-2">Nama Akun</th>
              <th className="px-3 py-2">Referensi</th>
              <th className="px-3 py-2">Keterangan</th>
              <th className="px-3 py-2 text-right">Debet</th>
              <th className="px-3 py-2 text-right">Kredit</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {draft.lines.map((line, index) => (
              <tr
                key={line.id}
                className={cn('border-b', line.warning && 'bg-orange-50')}
              >
                <td className="px-3 py-2">{index + 1}</td>
                <td className="px-3 py-2 whitespace-nowrap">{line.transactionDate}</td>
                <td className="px-3 py-2">{line.accountCode}</td>
                <td className="px-3 py-2">{line.accountName ?? '—'}</td>
                <td className="px-3 py-2">{line.reference || '—'}</td>
                <td className="px-3 py-2">
                  {line.description || '—'}
                  {line.warning && (
                    <p className="mt-1 text-xs text-orange-600">{line.warning}</p>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {Number(line.debit) > 0 ? formatIdrAmount(line.debit) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {Number(line.credit) > 0 ? formatIdrAmount(line.credit) : '—'}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    className="rounded-md bg-orange-400 px-2 py-1 text-xs font-medium text-white hover:bg-orange-500"
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
            {draft.lines.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  Belum ada baris jurnal. Tambahkan baris di bawah.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t bg-slate-50 font-medium">
              <td colSpan={6} className="px-3 py-2 text-right">
                Total
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatIdrAmount(String(totals.debit))}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatIdrAmount(String(totals.credit))}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-6 grid gap-3 rounded-lg border border-dashed border-slate-300 p-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 xl:col-span-2">
          <span className="text-xs font-medium text-slate-600">Kode Akun</span>
          <SearchableSelect
            options={accountOptions}
            value={lineAccountId}
            onChange={setLineAccountId}
            placeholder="Pilih akun…"
            loading={loadingAccounts}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">Tgl Transaksi</span>
          <input
            type="date"
            value={lineDate}
            onChange={(e) => setLineDate(e.target.value)}
            className="w-full rounded-md border border-input px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">Referensi</span>
          <input
            value={lineReference}
            onChange={(e) => setLineReference(e.target.value)}
            className="w-full rounded-md border border-input px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 xl:col-span-2">
          <span className="text-xs font-medium text-slate-600">Keterangan</span>
          <input
            value={lineDescription}
            onChange={(e) => setLineDescription(e.target.value)}
            className="w-full rounded-md border border-input px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">Debet</span>
          <input
            value={lineDebit}
            onChange={(e) => setLineDebit(e.target.value)}
            className="w-full rounded-md border border-input px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-600">Kredit</span>
          <input
            value={lineCredit}
            onChange={(e) => setLineCredit(e.target.value)}
            className="w-full rounded-md border border-input px-3 py-2 text-sm"
          />
        </label>
        <div className="flex items-end xl:col-span-4">
          <button
            type="button"
            onClick={addLine}
            className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
          >
            Tambah Baris
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-60"
        >
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
        <button
          type="button"
          onClick={cancel}
          className="rounded-md bg-orange-400 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
        >
          Batal
        </button>
      </div>
    </div>
  );
}
