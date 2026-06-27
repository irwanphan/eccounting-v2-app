'use client';

import type { TrialBalanceReport } from '@eccounting/shared';
import { Download } from 'lucide-react';
import { useState } from 'react';

import { ApiError, apiDownload, apiFetch } from '@/lib/api-client';
import { getSelectedCompany } from '@/lib/company-store';
import { defaultMonth, formatIdrAmount } from '@/lib/format-idr';

interface TrialBalanceResponse {
  data: TrialBalanceReport;
}

function exportFilename(month: string): string {
  return `Neraca Saldo (${month}).xlsx`;
}

export function TrialBalancePage(): JSX.Element {
  const companyId = getSelectedCompany()?.id;
  const [month, setMonth] = useState(defaultMonth());
  const [report, setReport] = useState<TrialBalanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadReport(): Promise<void> {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ month });
      const res = await apiFetch<TrialBalanceResponse>(
        `/companies/${companyId}/reports/trial-balance?${qs}`,
      );
      setReport(res.data);
    } catch (err) {
      setReport(null);
      setError(err instanceof ApiError ? err.message : 'Gagal memuat neraca saldo');
    } finally {
      setLoading(false);
    }
  }

  async function exportExcel(): Promise<void> {
    if (!companyId) return;
    setExporting(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ month });
      await apiDownload(
        `/companies/${companyId}/reports/trial-balance/export?${qs}`,
        exportFilename(month),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengunduh Excel');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label htmlFor="month" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Bulan
            </label>
            <input
              id="month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="block rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadReport()}
            disabled={loading || !companyId}
            className="rounded-md bg-sky-500 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-sky-600 disabled:opacity-60 transition duration-300 cursor-pointer"
          >
            {loading ? 'Memuat…' : 'Tampil'}
          </button>
          <button
            type="button"
            onClick={() => void exportExcel()}
            disabled={exporting || !companyId}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 transition duration-300 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Mengunduh…' : 'Export .XLSX'}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        {report && (
          <div className="mt-6 overflow-x-auto rounded-lg border border-sky-300 p-2 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="border-b bg-slate-50/80">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Kode Akun</th>
                  <th className="px-3 py-2 text-left font-medium">Nama</th>
                  <th className="px-3 py-2 text-right font-medium">Debet</th>
                  <th className="px-3 py-2 text-right font-medium">Kredit</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-slate-50/80">
                    <td
                      className="px-3 py-2 font-mono text-xs text-slate-600"
                      style={{ paddingLeft: `${row.level * 1.25 + 0.75}rem` }}
                    >
                      {row.code}
                    </td>
                    <td
                      className="px-3 py-2"
                      style={{ paddingLeft: `${row.level * 1.25 + 0.75}rem` }}
                    >
                      {row.name}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {Number(row.debit) !== 0 ? formatIdrAmount(row.debit) : ''}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {Number(row.credit) !== 0 ? formatIdrAmount(row.credit) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-slate-50/50 font-semibold">
                <tr>
                  <td colSpan={2} className="px-3 py-2" />
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatIdrAmount(report.totalDebit)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatIdrAmount(report.totalCredit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        
      </div>
    </>
  );
}
