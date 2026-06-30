'use client';

import type { AccountOption, GeneralLedgerReport } from '@eccounting/shared';
import { Download } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  SearchableSelect,
  type SearchableSelectOption,
} from '@/components/ui/searchable-select';
import { ApiError, apiDownload, apiFetch } from '@/lib/api-client';
import { getSelectedCompany } from '@/lib/company-store';
import { defaultMonthDateRange, formatDisplayDate, formatIdrAmount } from '@/lib/format-idr';

interface AccountsResponse {
  data: AccountOption[];
}

interface LedgerResponse {
  data: GeneralLedgerReport | null;
}

function toAccountOptions(accounts: AccountOption[]): SearchableSelectOption[] {
  return accounts.map((a) => ({
    value: a.id,
    label: `${a.code} - ${a.name}`,
    searchText: `${a.code} ${a.name}`,
    indent: a.level,
  }));
}

export function GeneralLedgerPage(): JSX.Element {
  const companyId = getSelectedCompany()?.id;
  const defaults = defaultMonthDateRange();

  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState('');
  const [dateStart, setDateStart] = useState(defaults.dateStart);
  const [dateEnd, setDateEnd] = useState(defaults.dateEnd);
  const [report, setReport] = useState<GeneralLedgerReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    void (async () => {
      setAccountsLoading(true);
      setAccountsError(null);
      try {
        const res = await apiFetch<AccountsResponse>(
          `/companies/${companyId}/reports/accounts`,
          { companyId },
        );
        setAccounts(res.data);
        if (res.data[0]) setAccountId(res.data[0].id);
      } catch (err) {
        setAccounts([]);
        setAccountId('');
        setAccountsError(
          err instanceof ApiError
            ? err.message
            : 'Gagal memuat daftar akun. Pastikan API sudah di-restart setelah update terbaru.',
        );
      } finally {
        setAccountsLoading(false);
      }
    })();
  }, [companyId]);

  const accountOptions = useMemo(() => toAccountOptions(accounts), [accounts]);

  async function loadReport(): Promise<void> {
    if (!companyId || !accountId) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ accountId, dateStart, dateEnd });
      const res = await apiFetch<LedgerResponse>(
        `/companies/${companyId}/reports/general-ledger?${qs}`,
      );
      setReport(res.data);
    } catch (err) {
      setReport(null);
      setError(err instanceof ApiError ? err.message : 'Gagal memuat buku besar');
    } finally {
      setLoading(false);
    }
  }

  async function exportExcel(): Promise<void> {
    if (!companyId || !accountId) return;
    setExporting(true);
    setError(null);
    try {
      const selected = accounts.find((a) => a.id === accountId);
      const qs = new URLSearchParams({ accountId, dateStart, dateEnd });
      const fallbackName = selected
        ? `Buku Besar (${selected.code}-${selected.name}) ${dateStart} sd ${dateEnd}.xlsx`
        : `Buku Besar ${dateStart} sd ${dateEnd}.xlsx`;
      await apiDownload(
        `/companies/${companyId}/reports/general-ledger/export?${qs}`,
        fallbackName,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengunduh Excel');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-1">
          <SearchableSelect
            label="Kode Akun"
            options={accountOptions}
            value={accountId}
            onChange={setAccountId}
            loading={accountsLoading}
            disabled={accounts.length === 0 && !accountsLoading}
            placeholder="Pilih akun…"
            searchPlaceholder="Cari kode atau nama akun…"
            emptyMessage="— belum ada akun —"
            noResultsMessage="Akun tidak ditemukan"
          />
          {accountsError && (
            <p className="text-xs text-destructive">{accountsError}</p>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Tanggal</span>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">sampai dengan</span>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
            />
          </label>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={loadReport}
          disabled={loading || !accountId}
          className="rounded-md bg-sky-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-sky-600 disabled:opacity-60 transition duration-300 cursor-pointer"
        >
          Tampil
        </button>
        <button
          type="button"
          onClick={() => void exportExcel()}
          disabled={exporting || !accountId || !companyId}
          className="inline-flex items-center gap-2 rounded-md bg-green-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-green-600 disabled:opacity-60 transition duration-300 cursor-pointer"
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Mengunduh…' : 'Export .XLSX'}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {report && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-sky-300 p-2 bg-white shadow-sm">
          <p className="mb-4 text-sm text-muted-foreground">
            {report.account.code} — {report.account.name} · {formatDisplayDate(report.dateStart)} s/d{' '}
            {formatDisplayDate(report.dateEnd)}
          </p>
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                <th className="px-3 py-2">No</th>
                <th className="px-3 py-2">Tgl</th>
                <th className="px-3 py-2">No. Form</th>
                <th className="px-3 py-2">Referensi</th>
                <th className="px-3 py-2">Keterangan</th>
                <th className="px-3 py-2 text-right">Nilai</th>
                <th className="px-3 py-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b font-medium">
                <td colSpan={5} className="px-3 py-2" />
                <td className="px-3 py-2 text-right">Saldo Awal</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatIdrAmount(report.openingBalance)}
                </td>
              </tr>
              {report.lines.map((line) => (
                <tr key={`${line.postingNumber}-${line.lineNo}`} className="border-b hover:bg-slate-50/80">
                  <td className="px-3 py-2">{line.lineNo}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDisplayDate(line.transactionDate)}</td>
                  <td className="px-3 py-2">{line.postingNumber}</td>
                  <td className="px-3 py-2">{line.reference ?? '—'}</td>
                  <td className="px-3 py-2">{line.description ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatIdrAmount(line.amount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatIdrAmount(line.balance)}</td>
                </tr>
              ))}
              {report.retainedEarningsInPeriod != null && (
                <tr className="border-b font-medium">
                  <td colSpan={6} className="px-3 py-2">
                    Laba Rugi Periode Berjalan ({formatDisplayDate(report.dateStart)} s/d{' '}
                    {formatDisplayDate(report.dateEnd)})
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatIdrAmount(report.retainedEarningsInPeriod)}
                  </td>
                </tr>
              )}
              <tr className="font-medium">
                <td colSpan={5} className="px-3 py-2" />
                <td className="px-3 py-2 text-right">Saldo Akhir</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatIdrAmount(report.closingBalance)}
                </td>
              </tr>
            </tbody>
          </table>
          {report.lines.length === 0 && !loading && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Tidak ada transaksi pada rentang tanggal ini.
            </p>
          )}
        </div>
      )}

    </div>
  );
}
