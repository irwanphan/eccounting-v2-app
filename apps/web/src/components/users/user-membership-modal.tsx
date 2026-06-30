'use client';

import type { CompanyRole } from '@eccounting/shared';
import { Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { ModalShell } from '@/components/ui/modal-shell';
import { ApiError, apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export interface UserMembershipItem {
  companyId: string;
  companyName: string;
  role: CompanyRole;
}

interface CompanyOption {
  id: string;
  name: string;
}

const ROLE_LABELS: Record<CompanyRole, string> = {
  owner: 'Pemilik',
  accountant: 'Akuntan',
  viewer: 'Viewer',
};

interface UserMembershipModalProps {
  userName: string;
  userId: string;
  open: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

export function UserMembershipModal({
  userName,
  userId,
  open,
  onClose,
  onChanged,
}: UserMembershipModalProps): JSX.Element | null {
  const [memberships, setMemberships] = useState<UserMembershipItem[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState('');
  const [role, setRole] = useState<CompanyRole>('accountant');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch<{ data: UserMembershipItem[] }>(`/users/${userId}/memberships`),
      apiFetch<Array<Record<string, unknown>>>('/companies?all=true'),
    ])
      .then(([membershipRes, companyRows]) => {
        setMemberships(membershipRes.data);
        setCompanies(
          companyRows.map((row) => ({
            id: String(row.id),
            name: String(row.name),
          })),
        );
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Gagal memuat akses klien');
      })
      .finally(() => setLoading(false));
  }, [open, userId]);

  const availableCompanies = useMemo(() => {
    const assigned = new Set(memberships.map((m) => m.companyId));
    return companies.filter((c) => !assigned.has(c.id));
  }, [companies, memberships]);

  useEffect(() => {
    if (!open) return;
    setCompanyId(availableCompanies[0]?.id ?? '');
  }, [open, availableCompanies]);

  async function reloadMemberships(): Promise<void> {
    const res = await apiFetch<{ data: UserMembershipItem[] }>(`/users/${userId}/memberships`);
    setMemberships(res.data);
    await onChanged();
  }

  async function handleAdd(): Promise<void> {
    if (!companyId) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/companies/${companyId}/members`, {
        method: 'POST',
        body: { userId, role },
      });
      await reloadMemberships();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menambah akses klien');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddAll(): Promise<void> {
    if (availableCompanies.length === 0) return;
    const ok = window.confirm(
      `Tambah akses ke ${availableCompanies.length} klien sebagai ${ROLE_LABELS[role]}?`,
    );
    if (!ok) return;

    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/users/${userId}/memberships/add-all`, {
        method: 'POST',
        body: { role },
      });
      await reloadMemberships();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menambah semua akses klien');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveAll(): Promise<void> {
    if (memberships.length === 0) return;
    const ok = window.confirm(`Hapus semua ${memberships.length} akses klien untuk pengguna ini?`);
    if (!ok) return;

    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/users/${userId}/memberships`, { method: 'DELETE' });
      await reloadMemberships();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghapus semua akses klien');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(targetCompanyId: string): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/companies/${targetCompanyId}/members/${userId}`, { method: 'DELETE' });
      setMemberships((prev) => prev.filter((m) => m.companyId !== targetCompanyId));
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghapus akses klien');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={`Akses Klien — ${userName}`}
      titleId="user-membership-title"
      maxWidthClass="max-w-2xl"
      bottomBar={
        !loading && availableCompanies.length > 0 ? (
          <div className="min-w-0 space-y-3">
            <p className="text-sm font-medium text-slate-700">Tambah akses klien</p>
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <select
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="w-full max-w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                  >
                    {availableCompanies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as CompanyRole)}
                  className="w-full shrink-0 rounded-md border border-input bg-white px-3 py-2 text-sm sm:w-28"
                >
                  {(Object.keys(ROLE_LABELS) as CompanyRole[]).map((key) => (
                    <option key={key} value={key}>
                      {ROLE_LABELS[key]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={saving || !companyId}
                  onClick={() => void handleAdd()}
                  className={cn(
                    'shrink-0 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                  )}
                >
                  Tambah
                </button>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleAddAll()}
                className={cn(
                  'w-full rounded-md border border-emerald-600 bg-white px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 sm:w-auto sm:self-start',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                )}
              >
                Tambah semua ({availableCompanies.length} klien) sebagai {ROLE_LABELS[role]}
              </button>
            </div>
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : undefined
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          {memberships.length > 0 ? (
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => void handleRemoveAll()}
              className="rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Hapus semua ({memberships.length} klien)
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600"
          >
            Tutup
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Di v1, peran diatur global via Voyager. Di v2, akses diatur per klien (owner / akuntan /
          viewer).
        </p>

        {loading && <p className="text-sm text-muted-foreground">Memuat…</p>}

        {!loading && (
          <>
            <p className="mb-2 text-sm font-medium text-slate-700">{memberships.length} klien</p>
            <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
            {memberships.map((item) => (
              <li key={item.companyId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{item.companyName}</p>
                  <p className="text-xs text-slate-500">{ROLE_LABELS[item.role]}</p>
                </div>
                <button
                  type="button"
                  title="Hapus akses"
                  disabled={saving}
                  onClick={() => void handleRemove(item.companyId)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white transition hover:bg-rose-600 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
            {memberships.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-slate-500">
                Belum punya akses ke klien manapun.
              </li>
            )}
          </ul>
          </>
        )}
      </div>
    </ModalShell>
  );
}
