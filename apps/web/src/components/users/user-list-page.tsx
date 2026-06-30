'use client';

import type { UserListItem } from '@eccounting/shared';
import { Building2, Pencil, Search, Trash2, UserCheck } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ClientActionButton } from '@/components/companies/client-action-button';
import { ApiError, apiFetch } from '@/lib/api-client';
import { formatDisplayDate } from '@/lib/format-idr';
import { cn } from '@/lib/utils';

import { UserDeactivateModal } from './user-deactivate-modal';
import { UserFormModal } from './user-form-modal';
import { UserMembershipModal } from './user-membership-modal';

const PAGE_SIZE = 20;

interface UserListPageProps {
  users: UserListItem[];
  onRefresh: () => Promise<void>;
  createFormOpen: boolean;
  onCreateFormOpenChange: (open: boolean) => void;
}

export function UserListPage({
  users,
  onRefresh,
  createFormOpen,
  onCreateFormOpenChange,
}: UserListPageProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pendingEdit, setPendingEdit] = useState<UserListItem | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = useState<UserListItem | null>(null);
  const [pendingMembership, setPendingMembership] = useState<UserListItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q),
    );
  }, [users, query]);

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

  async function handleCreate(values: { name: string; email: string; password: string }): Promise<void> {
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch('/users', {
        method: 'POST',
        body: {
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
        },
      });
      onCreateFormOpenChange(false);
      await onRefresh();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Gagal menyimpan pengguna baru.');
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(values: { name: string; password: string }): Promise<void> {
    if (!pendingEdit) return;
    setSaving(true);
    setFormError(null);
    try {
      const body: Record<string, unknown> = { name: values.name.trim() };
      if (values.password) body.password = values.password;
      await apiFetch(`/users/${pendingEdit.id}`, { method: 'PATCH', body });
      setPendingEdit(null);
      await onRefresh();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Gagal menyimpan perubahan.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReactivate(user: UserListItem): Promise<void> {
    try {
      await apiFetch(`/users/${user.id}`, {
        method: 'PATCH',
        body: { isActive: true },
      });
      await onRefresh();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'Gagal mengaktifkan pengguna.');
    }
  }

  async function confirmDeactivate(): Promise<void> {
    if (!pendingDeactivate) return;
    setDeactivating(true);
    try {
      await apiFetch(`/users/${pendingDeactivate.id}`, {
        method: 'PATCH',
        body: { isActive: false },
      });
      setPendingDeactivate(null);
      await onRefresh();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'Gagal menonaktifkan pengguna.');
    } finally {
      setDeactivating(false);
    }
  }

  const pageNumbers = buildPageNumbers(currentPage, totalPages);

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-sky-300/70 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-lg font-bold tracking-wider text-slate-600">Daftar Pengguna</p>
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
          {pageItems.map((user) => (
            <li
              key={user.id}
              className="flex items-center justify-between gap-4 px-4 py-4 transition hover:bg-slate-50/80 sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-base font-semibold text-slate-900">{user.name}</p>
                  {!user.isActive && (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                      Nonaktif
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-sm text-slate-500">{user.email}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {user.membershipCount} klien · Terakhir login{' '}
                  {user.lastLoginAt ? formatDisplayDate(user.lastLoginAt) : '—'} · Dibuat{' '}
                  {formatDisplayDate(user.createdAt)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <ClientActionButton
                  icon={Building2}
                  title="Kelola akses klien"
                  variant="select"
                  onClick={() => setPendingMembership(user)}
                />
                <ClientActionButton
                  icon={Pencil}
                  title="Ubah pengguna"
                  variant="edit"
                  onClick={() => {
                    setFormError(null);
                    setPendingEdit(user);
                  }}
                />
                {user.isActive ? (
                  <ClientActionButton
                    icon={Trash2}
                    title="Nonaktifkan pengguna"
                    variant="delete"
                    onClick={() => setPendingDeactivate(user)}
                  />
                ) : (
                  <ClientActionButton
                    icon={UserCheck}
                    title="Aktifkan kembali"
                    variant="select"
                    onClick={() => void handleReactivate(user)}
                  />
                )}
              </div>
            </li>
          ))}

          {pageItems.length === 0 && (
            <li className="px-4 py-12 text-center text-sm text-slate-500 sm:px-5">
              Tidak ada pengguna yang cocok.
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

      <UserFormModal
        mode="create"
        open={createFormOpen}
        saving={saving}
        serverError={formError}
        onClose={() => {
          onCreateFormOpenChange(false);
          setFormError(null);
        }}
        onSubmitCreate={handleCreate}
        onSubmitEdit={async () => {}}
      />

      <UserFormModal
        mode="edit"
        open={pendingEdit !== null}
        saving={saving}
        serverError={formError}
        initialName={pendingEdit?.name}
        initialEmail={pendingEdit?.email}
        onClose={() => {
          setPendingEdit(null);
          setFormError(null);
        }}
        onSubmitCreate={async () => {}}
        onSubmitEdit={handleEdit}
      />

      {pendingDeactivate && (
        <UserDeactivateModal
          userName={pendingDeactivate.name}
          deactivating={deactivating}
          onCancel={() => setPendingDeactivate(null)}
          onConfirm={() => void confirmDeactivate()}
        />
      )}

      {pendingMembership && (
        <UserMembershipModal
          userName={pendingMembership.name}
          userId={pendingMembership.id}
          open
          onClose={() => setPendingMembership(null)}
          onChanged={onRefresh}
        />
      )}
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

interface UsersResponse {
  data: UserListItem[];
}

export async function fetchUsers(): Promise<UserListItem[]> {
  const res = await apiFetch<UsersResponse>('/users');
  return res.data;
}

export function getUsersErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Gagal memuat daftar pengguna.';
}
