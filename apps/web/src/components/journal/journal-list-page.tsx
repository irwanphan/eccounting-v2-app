'use client';

import type { JournalDetailRow, JournalGroupedRow, JournalLineView } from '@eccounting/shared';
import { Eye, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ApiError, apiFetch } from '@/lib/api-client';
import { getSelectedCompany } from '@/lib/company-store';
import { defaultMonthDateRange, formatDisplayDate, formatIdrAmount } from '@/lib/format-idr';
import { cn } from '@/lib/utils';

type ViewMode = 'grouped' | 'detail';

interface GroupedResponse {
  data: JournalGroupedRow[];
}

interface DetailResponse {
  data: JournalDetailRow[];
}

interface LinesResponse {
  entry: { id: string; postingNumber: string; postingDate: string; description: string | null } | null;
  lines: JournalLineView[];
}

export function JournalListPage(): JSX.Element {
  const company = getSelectedCompany();
  const defaults = defaultMonthDateRange();

  const [dateStart, setDateStart] = useState(defaults.dateStart);
  const [dateEnd, setDateEnd] = useState(defaults.dateEnd);
  const [viewMode, setViewMode] = useState<ViewMode | null>(null);
  const [groupedRows, setGroupedRows] = useState<JournalGroupedRow[]>([]);
  const [detailRows, setDetailRows] = useState<JournalDetailRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewEntryId, setViewEntryId] = useState<string | null>(null);
  const [viewLines, setViewLines] = useState<JournalLineView[]>([]);
  const [viewPostingNumber, setViewPostingNumber] = useState('');

  async function loadGrouped(): Promise<void> {
    if (!company) return;
    setLoading(true);
    setError(null);
    setViewMode('grouped');
    try {
      const res = await apiFetch<GroupedResponse>(
        `/companies/${company.id}/journal-entries/grouped?dateStart=${dateStart}&dateEnd=${dateEnd}`,
      );
      setGroupedRows(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data jurnal');
      setGroupedRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(): Promise<void> {
    if (!company) return;
    setLoading(true);
    setError(null);
    setViewMode('detail');
    try {
      const res = await apiFetch<DetailResponse>(
        `/companies/${company.id}/journal-entries/detail?dateStart=${dateStart}&dateEnd=${dateEnd}`,
      );
      setDetailRows(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat detail jurnal');
      setDetailRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function openView(entryId: string, postingNumber: string): Promise<void> {
    if (!company) return;
    setViewEntryId(entryId);
    setViewPostingNumber(postingNumber);
    try {
      const res = await apiFetch<LinesResponse>(
        `/companies/${company.id}/journal-entries/${entryId}/lines`,
      );
      setViewLines(res.lines);
    } catch {
      setViewLines([]);
    }
  }

  const filteredGrouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groupedRows;
    return groupedRows.filter(
      (r) =>
        r.postingNumber.toLowerCase().includes(q) ||
        (r.description?.toLowerCase().includes(q) ?? false),
    );
  }, [groupedRows, search]);

  const filteredDetail = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return detailRows;
    return detailRows.filter(
      (r) =>
        r.postingNumber.toLowerCase().includes(q) ||
        r.accountCode.toLowerCase().includes(q) ||
        r.accountName.toLowerCase().includes(q) ||
        (r.description?.toLowerCase().includes(q) ?? false),
    );
  }, [detailRows, search]);

  return (
    <>
      {/* Filter panel — setara v1 panel-bordered */}
      <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Tanggal Pencatatan Jurnal
        </p>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-4">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Tanggal</span>
              <input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
              />
            </label>
            <span className="pb-2 text-sm text-muted-foreground">sampai dengan</span>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">&nbsp;</span>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={loadGrouped}
              disabled={loading}
              className={cn(
                'rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm transition duration-300 cursor-pointer',
                viewMode === 'grouped' ? 'bg-sky-500' : 'bg-sky-500/90 hover:bg-sky-500',
              )}
            >
              Tampil
            </button>
            <button
              type="button"
              onClick={loadDetail}
              disabled={loading}
              className={cn(
                'rounded-md border border-border px-4 py-2 text-sm font-medium shadow-sm transition duration-300 cursor-pointer',
                viewMode === 'detail'
                  ? 'bg-slate-200 text-slate-800'
                  : 'bg-muted text-muted-foreground hover:bg-slate-200',
              )}
            >
              Detil
            </button>
          </div>
        </div>

        {viewMode && (
          <div className="mt-6 rounded-lg border border-sky-300 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {loading
                  ? 'Memuat…'
                  : viewMode === 'grouped'
                    ? `${filteredGrouped.length} posting`
                    : `${filteredDetail.length} baris jurnal`}
                {' · '}
                {formatDisplayDate(dateStart)} — {formatDisplayDate(dateEnd)}
              </p>
              <label className="relative block w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-md border border-input py-2 pl-9 pr-3 text-sm"
                />
              </label>
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {!loading && !error && viewMode === 'grouped' && filteredGrouped.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Tidak ada jurnal pada rentang tanggal ini. Data akan muncul setelah ETL dari v1 selesai.
              </p>
            )}

            {!loading && viewMode === 'grouped' && filteredGrouped.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                      <th className="px-2 py-2">No</th>
                      <th className="px-2 py-2">No. Form</th>
                      <th className="px-2 py-2">Tgl Form</th>
                      <th className="px-2 py-2 text-right">Total Debet</th>
                      <th className="px-2 py-2 text-right">Total Kredit</th>
                      <th className="px-2 py-2">Catatan</th>
                      <th className="px-2 py-2">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGrouped.map((row, idx) => (
                      <tr key={row.id} className="border-b border-border/60 hover:bg-muted/30">
                        <td className="px-2 py-2">{idx + 1}</td>
                        <td className="px-2 py-2 font-medium">{row.postingNumber}</td>
                        <td className="px-2 py-2">{row.postingDate}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatIdrAmount(row.totalDebit)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatIdrAmount(row.totalCredit)}</td>
                        <td className="px-2 py-2">
                          {row.isImported && (
                            <span className="mr-1 font-semibold text-emerald-700">[ IMPORTED ]</span>
                          )}
                          {row.description ?? ''}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              title="Lihat"
                              onClick={() => openView(row.id, row.postingNumber)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Hapus (menyusul — v2 pakai reversal)"
                              disabled
                              className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-full bg-orange-400/50 text-white"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && viewMode === 'detail' && filteredDetail.length === 0 && !error && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Tidak ada baris jurnal pada rentang tanggal ini.
              </p>
            )}

            {!loading && viewMode === 'detail' && filteredDetail.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                      <th className="px-2 py-2">No</th>
                      <th className="px-2 py-2">No. Form</th>
                      <th className="px-2 py-2">Tgl. Form</th>
                      <th className="px-2 py-2">Tgl. Transaksi</th>
                      <th className="px-2 py-2">Kode Akun</th>
                      <th className="px-2 py-2">Keterangan</th>
                      <th className="px-2 py-2 text-right">Debet</th>
                      <th className="px-2 py-2 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDetail.map((row, idx) => (
                      <tr key={row.id} className="border-b border-border/60 hover:bg-muted/30">
                        <td className="px-2 py-2">{idx + 1}</td>
                        <td className="px-2 py-2">{row.postingNumber}</td>
                        <td className="px-2 py-2">{row.postingDate}</td>
                        <td className="px-2 py-2">{row.transactionDate}</td>
                        <td className="px-2 py-2">
                          {row.accountCode} — {row.accountName}
                        </td>
                        <td className="px-2 py-2">{row.description ?? '—'}</td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {Number(row.debit) > 0 ? formatIdrAmount(row.debit) : '—'}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {Number(row.credit) > 0 ? formatIdrAmount(row.credit) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal Lihat — setara v1 summary */}
        {viewEntryId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-lg border border-sky-300 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="font-semibold">Jurnal {viewPostingNumber}</h2>
                <button
                  type="button"
                  onClick={() => setViewEntryId(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
              <div className="overflow-x-auto p-4">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="px-2 py-2">Tgl. Transaksi</th>
                      <th className="px-2 py-2">Kode Akun</th>
                      <th className="px-2 py-2">Referensi</th>
                      <th className="px-2 py-2">Keterangan</th>
                      <th className="px-2 py-2 text-right">Debet</th>
                      <th className="px-2 py-2 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewLines.map((line) => (
                      <tr key={line.id} className="border-b border-border/60">
                        <td className="px-2 py-2">{line.transactionDate}</td>
                        <td className="px-2 py-2">
                          {line.accountCode} — {line.accountName}
                        </td>
                        <td className="px-2 py-2">{line.reference ?? '—'}</td>
                        <td className="px-2 py-2">{line.description ?? '—'}</td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {Number(line.debit) > 0 ? formatIdrAmount(line.debit) : '—'}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {Number(line.credit) > 0 ? formatIdrAmount(line.credit) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
