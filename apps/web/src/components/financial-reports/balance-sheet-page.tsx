'use client';

import type { BalanceSheetReport } from '@eccounting/shared';
import { Download } from 'lucide-react';
import { useState } from 'react';

import { ApiError, apiDownload, apiFetch } from '@/lib/api-client';
import { getSelectedCompany } from '@/lib/company-store';
import { defaultMonth, formatIdrAmount } from '@/lib/format-idr';

import { MonthYearSelect } from './month-year-select';

interface BalanceSheetResponse {
  data: BalanceSheetReport;
}

function exportFilename(month: string): string {
  const [year, mon] = month.split('-');
  if (!year || !mon) return `Neraca (${month}).xlsx`;
  const lastDay = new Date(Number(year), Number(mon), 0).getDate();
  const dateStart = `${year}-${mon}-01`;
  const dateEnd = `${year}-${mon}-${String(lastDay).padStart(2, '0')}`;
  return `Neraca (${dateStart} sd ${dateEnd}).xlsx`;
}

export function BalanceSheetPage(): JSX.Element {
  const companyId = getSelectedCompany()?.id;
  const [month, setMonth] = useState(defaultMonth());
  const [report, setReport] = useState<BalanceSheetReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadReport(): Promise<void> {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ month });
      const res = await apiFetch<BalanceSheetResponse>(
        `/companies/${companyId}/reports/balance-sheet?${qs}`,
      );
      setReport(res.data);
    } catch (err) {
      setReport(null);
      setError(err instanceof ApiError ? err.message : 'Gagal memuat neraca');
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
        `/companies/${companyId}/reports/balance-sheet/export?${qs}`,
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
          <MonthYearSelect idPrefix="balance-sheet" value={month} onChange={setMonth} />
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
          <div className="mt-6 space-y-8 border border-sky-300 rounded-lg shadow-sm bg-white p-6">
            {report.sections.map((section) => (
              <div key={section.name}>
                <h2 className="mb-4 text-lg font-semibold uppercase tracking-wide text-slate-800">
                  {section.name}
                </h2>

                {section.subsections.map((sub) => (
                  <div key={sub.name} className="mb-6">
                    <h3 className="mb-2 text-sm font-medium text-slate-700">{sub.name}</h3>
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
                          {sub.rows.map((row) => (
                            <tr key={`${sub.name}-${row.code}-${row.level}`} className="border-b last:border-0">
                              <td
                                className="px-3 py-2 font-mono text-xs text-slate-600"
                                style={{ paddingLeft: `${(row.level - 1) * 1.25 + 0.75}rem` }}
                              >
                                {row.code}
                              </td>
                              <td className="px-3 py-2">{row.name}</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {row.amount != null ? formatIdrAmount(row.amount) : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t bg-slate-50/50 font-medium">
                          <tr>
                            <td colSpan={2} className="px-3 py-2 text-right">
                              Total
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatIdrAmount(sub.total)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-end gap-3 rounded-md bg-slate-100 px-4 py-3 font-semibold">
                  <span>{section.summaryLabel} :</span>
                  <span className="tabular-nums">{formatIdrAmount(section.summaryTotal)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        
      </div>
    </>
  );
}
