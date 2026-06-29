'use client';

import { useEffect, useState } from 'react';

import { ModalShell } from '@/components/ui/modal-shell';
import { cn } from '@/lib/utils';

export interface UserFormValues {
  name: string;
  email: string;
  password: string;
}

const EMPTY_CREATE: UserFormValues = {
  name: '',
  email: '',
  password: '',
};

interface UserFormModalProps {
  mode: 'create' | 'edit';
  open: boolean;
  saving: boolean;
  serverError: string | null;
  initialName?: string;
  initialEmail?: string;
  onClose: () => void;
  onSubmitCreate: (values: UserFormValues) => Promise<void>;
  onSubmitEdit: (values: { name: string; password: string }) => Promise<void>;
}

export function UserFormModal({
  mode,
  open,
  saving,
  serverError,
  initialName = '',
  initialEmail = '',
  onClose,
  onSubmitCreate,
  onSubmitEdit,
}: UserFormModalProps): JSX.Element | null {
  const [form, setForm] = useState<UserFormValues>(EMPTY_CREATE);
  const formId = mode === 'create' ? 'user-create-form' : 'user-edit-form';

  useEffect(() => {
    if (!open) return;
    if (mode === 'create') {
      setForm(EMPTY_CREATE);
      return;
    }
    setForm({ name: initialName, email: initialEmail, password: '' });
  }, [open, mode, initialName, initialEmail]);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (mode === 'create') {
      await onSubmitCreate(form);
      return;
    }
    await onSubmitEdit({ name: form.name.trim(), password: form.password.trim() });
  }

  const title = mode === 'create' ? 'Data Pengguna Baru' : 'Ubah Pengguna';

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={title}
      titleId="user-form-title"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-orange-400 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-500"
          >
            Batal
          </button>
          <button
            type="submit"
            form={formId}
            disabled={saving}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:opacity-60"
          >
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      }
    >
      <form id={formId} onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="user-name" className="text-sm font-medium text-slate-700">
            Nama
          </label>
          <input
            id="user-name"
            required
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            className={cn(
              'w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
              'focus:outline-none focus:ring-2 focus:ring-sky-400',
            )}
          />
        </div>

        {mode === 'create' && (
          <div className="space-y-1.5">
            <label htmlFor="user-email" className="text-sm font-medium text-slate-700">
              E-mail
            </label>
            <input
              id="user-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className={cn(
                'w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
                'focus:outline-none focus:ring-2 focus:ring-sky-400',
              )}
            />
          </div>
        )}

        {mode === 'edit' && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">E-mail</label>
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {initialEmail}
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="user-password" className="text-sm font-medium text-slate-700">
            {mode === 'create' ? 'Password' : 'Password baru (opsional)'}
          </label>
          <input
            id="user-password"
            type="password"
            required={mode === 'create'}
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            placeholder={mode === 'edit' ? 'Kosongkan jika tidak diubah' : undefined}
            className={cn(
              'w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
              'focus:outline-none focus:ring-2 focus:ring-sky-400',
            )}
          />
          <p className="text-xs text-slate-500">
            Minimal 12 karakter, huruf besar, huruf kecil, dan angka.
          </p>
        </div>

        {serverError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {serverError}
          </div>
        )}
      </form>
    </ModalShell>
  );
}
