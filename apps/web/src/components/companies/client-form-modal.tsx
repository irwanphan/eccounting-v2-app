'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface ClientFormValues {
  name: string;
  address: string;
  phone: string;
  email: string;
}

const EMPTY_FORM: ClientFormValues = {
  name: '',
  address: '',
  phone: '',
  email: '',
};

interface ClientFormModalProps {
  open: boolean;
  saving: boolean;
  serverError: string | null;
  onClose: () => void;
  onSubmit: (values: ClientFormValues) => Promise<void>;
}

export function ClientFormModal({
  open,
  saving,
  serverError,
  onClose,
  onSubmit,
}: ClientFormModalProps): JSX.Element | null {
  const [form, setForm] = useState<ClientFormValues>(EMPTY_FORM);

  useEffect(() => {
    if (open) setForm(EMPTY_FORM);
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    await onSubmit(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal
        aria-labelledby="client-form-title"
        className="w-full max-w-lg rounded-lg bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 id="client-form-title" className="text-base font-semibold uppercase tracking-wide text-slate-700">
            Data Klien Baru
          </h2>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-6 py-5">
          <div className="space-y-1.5">
            <label htmlFor="client-name" className="text-sm font-medium text-slate-700">
              Name
            </label>
            <input
              id="client-name"
              required
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="name"
              className={cn(
                'w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
                'focus:outline-none focus:ring-2 focus:ring-sky-400',
              )}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="client-address" className="text-sm font-medium text-slate-700">
              Address
            </label>
            <textarea
              id="client-address"
              rows={3}
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              className={cn(
                'w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
                'focus:outline-none focus:ring-2 focus:ring-sky-400',
              )}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="client-phone" className="text-sm font-medium text-slate-700">
              Phone
            </label>
            <input
              id="client-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="phone"
              className={cn(
                'w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
                'focus:outline-none focus:ring-2 focus:ring-sky-400',
              )}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="client-email" className="text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="client-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="email"
              className={cn(
                'w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
                'focus:outline-none focus:ring-2 focus:ring-sky-400',
              )}
            />
          </div>

          {serverError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-orange-400 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-500"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:opacity-60"
            >
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
