'use client';

import type { BalanceSheetReport } from '@eccounting/shared';
import { Download } from 'lucide-react';
import { useState } from 'react';

import { ApiError, apiFetch } from '@/lib/api-client';
import { getSelectedCompany } from '@/lib/company-store';
import { defaultMonth, formatIdrAmount } from '@/lib/format-idr';

interface BalanceSheetResponse {
  data: BalanceSheetReport;
}

export function BalanceSheetPage(): JSX.Element {
  const company = getSelectedCompany();
  const [month, setMonth] = useState(defaultMonth());
  const [report, setReport] = useState<BalanceSheetReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadReport(): Promise<void> {
    if (!company) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ month });
      const res = await apiFetch<BalanceSheetResponse>(
        `/companies/${company.id}/reports/balance-sheet?${qs}`,
      );
      setReport(res.data);
    } catch (err) {
      setReport(null);
      setError(err instanceof ApiError ? err.message : 'Gagal memuat neraca');
    } finally {
      setLoading(false);
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
            disabled={loading || !company}
            className="rounded-md bg-sky-500 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-sky-600 disabled:opacity-60"
          >
            {loading ? 'Memuat…' : 'Tampil'}
          </button>
          <button
            type="button"
            disabled
            title="Menyusul"
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white opacity-60"
          >
            <Download className="h-4 w-4" />
            Export .XLSX
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>

      {report && (
        <div className="mt-6 space-y-8">
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
    </>
  );
}
