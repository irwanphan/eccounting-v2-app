'use client';

import type { IncomeStatementReport } from '@eccounting/shared';
import { Download } from 'lucide-react';
import { useState } from 'react';

import { ApiError, apiDownload, apiFetch } from '@/lib/api-client';
import { getSelectedCompany } from '@/lib/company-store';
import { defaultMonthDateRange, formatDisplayDate, formatIdrAmount } from '@/lib/format-idr';

interface IncomeStatementResponse {
  data: IncomeStatementReport;
}

function exportFilename(dateStart: string, dateEnd: string): string {
  return `Laba Rugi (${dateStart} sd ${dateEnd}).xlsx`;
}

export function IncomeStatementPage(): JSX.Element {
  const companyId = getSelectedCompany()?.id;
  const defaults = defaultMonthDateRange();

  const [dateStart, setDateStart] = useState(defaults.dateStart);
  const [dateEnd, setDateEnd] = useState(defaults.dateEnd);
  const [report, setReport] = useState<IncomeStatementReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadReport(): Promise<void> {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ dateStart, dateEnd });
      const res = await apiFetch<IncomeStatementResponse>(
        `/companies/${companyId}/reports/income-statement?${qs}`,
      );
      setReport(res.data);
    } catch (err) {
      setReport(null);
      setError(err instanceof ApiError ? err.message : 'Gagal memuat laporan laba rugi');
    } finally {
      setLoading(false);
    }
  }

  async function exportExcel(): Promise<void> {
    if (!companyId) return;
    setExporting(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ dateStart, dateEnd });
      await apiDownload(
        `/companies/${companyId}/reports/income-statement/export?${qs}`,
        exportFilename(dateStart, dateEnd),
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
            <label
              htmlFor="dateStart"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Tanggal
            </label>
            <input
              id="dateStart"
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="block rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="dateEnd"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Sampai dengan
            </label>
            <input
              id="dateEnd"
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
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
          <div className="mt-6 space-y-8 border border-sky-300 rounded-lg p-6">
            <p className="text-sm text-muted-foreground">
              Periode {formatDisplayDate(report.dateStart)} — {formatDisplayDate(report.dateEnd)}
            </p>

            {report.blocks.map((block, index) => {
              if (block.kind === 'heading') {
                return (
                  <h2
                    key={`heading-${index}`}
                    className="text-lg font-semibold uppercase tracking-wide text-slate-800"
                  >
                    {block.label}
                  </h2>
                );
              }

              if (block.kind === 'summary') {
                return (
                  <div
                    key={`summary-${index}`}
                    className="flex items-baseline justify-end gap-3 border-t border-slate-200 pt-3 text-base font-semibold text-slate-900"
                  >
                    <span>{block.label} :</span>
                    <span className="tabular-nums">{formatIdrAmount(block.amount)}</span>
                  </div>
                );
              }

              return (
                <div key={`table-${index}`}>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">{block.title}</h3>
                  <div className="overflow-x-auto rounded-lg border border-border bg-white shadow-sm">
                    <table className="min-w-full text-sm">
                      <thead className="border-b bg-slate-50/80">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Kode akun</th>
                          <th className="px-3 py-2 text-left font-medium">Nama akun</th>
                          <th className="px-3 py-2 text-right font-medium">Nilai</th>
                        </tr>
                      </thead>
                      <tbody>
                        {block.rows.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">
                              —
                            </td>
                          </tr>
                        ) : (
                          block.rows.map((row) => (
                            <tr key={row.code} className="border-b last:border-0 hover:bg-slate-50/80">
                              <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.code}</td>
                              <td className="px-3 py-2">{row.name}</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatIdrAmount(row.amount)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot className="border-t bg-slate-50/50 font-semibold">
                        <tr>
                          <td colSpan={2} className="px-3 py-2" />
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatIdrAmount(block.total)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
      </div>

    </>
  );
}
