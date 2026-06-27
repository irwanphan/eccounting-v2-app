'use client';

import { ArrowLeftRight, Pencil, PhoneCall, MapPin, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ClientActionButton } from '@/components/companies/client-action-button';
import { ClientDeleteModal } from '@/components/companies/client-delete-modal';
import {
  ClientFormModal,
  type ClientFormValues,
} from '@/components/companies/client-form-modal';
import { ClientSelectModal } from '@/components/companies/client-select-modal';
import { ApiError, apiFetch } from '@/lib/api-client';
import { saveSelectedCompany } from '@/lib/company-store';
import { cn } from '@/lib/utils';

export interface CompanyListItem {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  legacyV1ClientId: string | null;
}

const PAGE_SIZE = 20;

interface ClientListPageProps {
  companies: CompanyListItem[];
  onRefresh: () => Promise<void>;
  createFormOpen: boolean;
  onCreateFormOpenChange: (open: boolean) => void;
}

export function ClientListPage({
  companies,
  onRefresh,
  createFormOpen,
  onCreateFormOpenChange,
}: ClientListPageProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pendingSelect, setPendingSelect] = useState<CompanyListItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CompanyListItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.address?.toLowerCase().includes(q) ?? false) ||
        (c.phone?.toLowerCase().includes(q) ?? false) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.legacyV1ClientId?.includes(q) ?? false),
    );
  }, [companies, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);

  function handleSearchChange(value: string): void {
    setQuery(value);
    setPage(1);
  }

  function confirmSelect(): void {
    if (!pendingSelect) return;
    saveSelectedCompany({
      id: pendingSelect.id,
      name: pendingSelect.name,
      legacyV1ClientId: pendingSelect.legacyV1ClientId,
    });
    window.location.href = '/dashboard';
  }

  async function handleCreate(values: ClientFormValues): Promise<void> {
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch('/companies', {
        method: 'POST',
        body: {
          name: values.name.trim(),
          address: values.address.trim() || undefined,
          phone: values.phone.trim() || undefined,
          email: values.email.trim() || undefined,
          seedDefaultCoa: true,
        },
      });
      onCreateFormOpenChange(false);
      await onRefresh();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Gagal menyimpan klien baru.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await apiFetch(`/companies/${pendingDelete.id}`, { method: 'DELETE' });
      setPendingDelete(null);
      await onRefresh();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'Gagal menghapus klien.');
    } finally {
      setDeleting(false);
    }
  }

  const pageNumbers = buildPageNumbers(currentPage, totalPages);

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-sky-300/70 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-sm font-medium text-slate-600">Daftar Klien</p>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="whitespace-nowrap">Search:</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => handleSearchChange(e.target.value)}
                className={cn(
                  'w-full min-w-[12rem] rounded-full border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm',
                  'focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400 sm:w-56',
                )}
              />
            </div>
          </label>
        </div>

        <p className="border-b border-slate-100 px-4 py-2 text-right text-xs text-slate-500 sm:px-5">
          Showing {rangeStart} to {rangeEnd} of {filtered.length} entries
        </p>

        <ul className="divide-y divide-slate-200">
          {pageItems.map((company) => (
            <li
              key={company.id}
              className="flex items-center justify-between gap-4 px-4 py-4 transition hover:bg-slate-50/80 sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-slate-900">{company.name}</p>
                <p className="mt-0.5 truncate text-sm text-slate-500">
                  <PhoneCall className="h-3 w-3 inline-block mr-0.5" /> {company.phone?.trim() || '—'}  <MapPin className="h-3 w-3 inline-block mr-0.5 ml-3 -mt-1" /> {company.address?.trim() || '—'}
                </p>
                {company.legacyV1ClientId && (
                  <p className="mt-1 text-xs text-slate-400">
                    v1 client #{company.legacyV1ClientId}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <ClientActionButton
                  icon={ArrowLeftRight}
                  title="Pilih klien"
                  variant="select"
                  onClick={() => setPendingSelect(company)}
                />
                <ClientActionButton
                  icon={Pencil}
                  title="Ubah klien (menyusul)"
                  variant="edit"
                  disabled
                />
                <ClientActionButton
                  icon={Trash2}
                  title="Hapus klien"
                  variant="delete"
                  onClick={() => setPendingDelete(company)}
                />
              </div>
            </li>
          ))}

          {pageItems.length === 0 && (
            <li className="px-4 py-12 text-center text-sm text-slate-500 sm:px-5">
              Tidak ada klien yang cocok.
            </li>
          )}
        </ul>

        {filtered.length > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-end gap-1 border-t border-slate-200 px-4 py-3 sm:px-5">
            <PaginationButton
              label="Previous"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            />
            {pageNumbers.map((item, index) =>
              item === '…' ? (
                <span key={`ellipsis-${index}`} className="px-2 text-sm text-slate-400">
                  …
                </span>
              ) : (
                <PaginationButton
                  key={item}
                  label={String(item)}
                  active={item === currentPage}
                  onClick={() => setPage(item)}
                />
              ),
            )}
            <PaginationButton
              label="Next"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            />
          </div>
        )}
      </div>

      {pendingSelect && (
        <ClientSelectModal
          clientName={pendingSelect.name}
          onCancel={() => setPendingSelect(null)}
          onConfirm={confirmSelect}
        />
      )}

      {pendingDelete && (
        <ClientDeleteModal
          clientName={pendingDelete.name}
          deleting={deleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}

      <ClientFormModal
        open={createFormOpen}
        saving={saving}
        serverError={formError}
        onClose={() => {
          onCreateFormOpenChange(false);
          setFormError(null);
        }}
        onSubmit={handleCreate}
      />
    </>
  );
}

function PaginationButton({
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'min-w-[2rem] rounded-full px-2.5 py-1 text-sm transition',
        active && 'border border-sky-500 text-sky-600',
        !active && !disabled && 'text-slate-600 hover:bg-slate-100',
        disabled && 'cursor-not-allowed text-slate-300',
      )}
    >
      {label}
    </button>
  );
}

function buildPageNumbers(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: Array<number | '…'> = [1];
  if (current > 3) pages.push('…');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i += 1) pages.push(i);

  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

export async function fetchCompanies(): Promise<CompanyListItem[]> {
  const rows = await apiFetch<Array<Record<string, unknown>>>('/companies?all=true');
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    address: row.address ? String(row.address) : null,
    phone: row.phone ? String(row.phone) : null,
    email: row.email ? String(row.email) : null,
    legacyV1ClientId: row.legacyV1ClientId ? String(row.legacyV1ClientId) : null,
  }));
}

export function getCompaniesErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Gagal memuat daftar klien.';
}
