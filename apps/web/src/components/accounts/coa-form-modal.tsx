'use client';

import type { AccountFlatRow, CoaFormInput } from '@eccounting/shared';
import { V1_COA_CATEGORIES } from '@eccounting/shared';
import { useEffect, useMemo, useState } from 'react';

import { ApiError } from '@/lib/api-client';

export type CoaFormMode = 'create-root' | 'create-child' | 'edit';

export interface CoaFormState {
  mode: CoaFormMode;
  account?: AccountFlatRow;
  parentId?: string | null;
}

interface CoaFormModalProps {
  open: boolean;
  formState: CoaFormState | null;
  flatAccounts: AccountFlatRow[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (input: CoaFormInput) => Promise<void>;
}

function parseCategoryId(subCategory: string | null): number {
  if (!subCategory) return 0;
  const parsed = Number.parseInt(subCategory, 10);
  return parsed >= 1 && parsed <= 8 ? parsed : 0;
}

export function CoaFormModal({
  open,
  formState,
  flatAccounts,
  saving,
  onClose,
  onSubmit,
}: CoaFormModalProps): JSX.Element | null {
  const [categoryId, setCategoryId] = useState(0);
  const [parentId, setParentId] = useState<string>('');
  const [normalBalance, setNormalBalance] = useState<'D' | 'C'>('D');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isRetainedEarning, setIsRetainedEarning] = useState(false);

  const isEdit = formState?.mode === 'edit';

  useEffect(() => {
    if (!open || !formState) return;

    if (formState.mode === 'create-root') {
      setCategoryId(0);
      setParentId('');
      setNormalBalance('D');
      setCode('');
      setName('');
      setIsRetainedEarning(false);
      return;
    }

    if (formState.mode === 'create-child') {
      setCategoryId(0);
      setParentId(formState.parentId ?? '');
      setNormalBalance('D');
      setCode('');
      setName('');
      setIsRetainedEarning(false);
      return;
    }

    const acc = formState.account!;
    setCategoryId(parseCategoryId(acc.subCategory));
    setParentId(acc.parentId ?? '');
    setNormalBalance(acc.normalBalance);
    setCode(acc.code);
    setName(acc.name);
    setIsRetainedEarning(acc.isRetainedEarning);
  }, [open, formState]);

  const parentOptions = useMemo(() => {
    const hasChildren = new Set<string>();
    for (const row of flatAccounts) {
      if (row.parentId) hasChildren.add(row.parentId);
    }

    return flatAccounts.map((row) => ({
      ...row,
      disabled: hasChildren.has(row.id) && row.id !== parentId,
    }));
  }, [flatAccounts, parentId]);

  if (!open || !formState) return null;

  const title =
    formState.mode === 'edit'
      ? `Edit Kode Akun "${formState.account?.code} ${formState.account?.name}"`
      : formState.mode === 'create-child'
        ? 'Buat Kode Akun Baru'
        : 'Buat Kode Akun Induk Baru';

  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    await onSubmit({
      parentId: parentId || null,
      code: code.trim(),
      name: name.trim(),
      normalBalance,
      categoryId,
      ...(isEdit ? { isRetainedEarning } : {}),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold uppercase tracking-wide text-slate-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        <form onSubmit={(e) => void handleFormSubmit(e)} className="space-y-4 px-6 py-5">
          <div className="space-y-1">
            <label htmlFor="coa-category" className="text-sm font-medium text-slate-700">
              Kategori
            </label>
            <select
              id="coa-category"
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {V1_COA_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="coa-parent" className="text-sm font-medium text-slate-700">
              Akun Induk
            </label>
            <select
              id="coa-parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              disabled={formState.mode === 'create-child'}
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:bg-slate-50"
            >
              <option value="">-No Parent-</option>
              {parentOptions.map((row) => (
                <option key={row.id} value={row.id} disabled={row.disabled}>
                  {'\u00A0'.repeat(row.level * 2)}
                  {row.code} {row.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="coa-normal-balance" className="text-sm font-medium text-slate-700">
              Debet/Kredit
            </label>
            <select
              id="coa-normal-balance"
              value={normalBalance}
              onChange={(e) => setNormalBalance(e.target.value as 'D' | 'C')}
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="D">Debet</option>
              <option value="C">Kredit</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="coa-code" className="text-sm font-medium text-slate-700">
              Kode
            </label>
            <input
              id="coa-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="coa-name" className="text-sm font-medium text-slate-700">
              Nama
            </label>
            <input
              id="coa-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {isEdit && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isRetainedEarning}
                onChange={(e) => setIsRetainedEarning(e.target.checked)}
                className="rounded border-input"
              />
              Akun Laba Rugi Periode Berjalan
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface CoaDeleteModalProps {
  open: boolean;
  account: AccountFlatRow | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function CoaDeleteModal({
  open,
  account,
  deleting,
  onClose,
  onConfirm,
}: CoaDeleteModalProps): JSX.Element | null {
  if (!open || !account) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">Hapus Kode Akun</h2>
        </div>
        <div className="space-y-4 px-6 py-5 text-sm text-slate-600">
          <p>
            Yakin hapus kode akun <strong>{account.code} {account.name}</strong>?
          </p>
          <p>Hapus turunan terlebih dahulu jika akun ini memiliki sub-akun.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={() => void onConfirm()}
            className="rounded-md bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? 'Menghapus…' : 'Hapus'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function getFlatAccount(
  flat: AccountFlatRow[],
  id: string,
): AccountFlatRow | undefined {
  return flat.find((row) => row.id === id);
}

export function findApiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}
