'use client';

import type { ReactNode } from 'react';

import { ModalShell } from '@/components/ui/modal-shell';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'default' | 'danger';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Ya',
  cancelLabel = 'Batal',
  onConfirm,
  onCancel,
  variant = 'default',
  loading = false,
}: ConfirmDialogProps): JSX.Element | null {
  return (
    <ModalShell
      open={open}
      onClose={onCancel}
      title={title}
      titleId="confirm-dialog-title"
      maxWidthClass="max-w-md"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-muted disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60',
              variant === 'danger'
                ? 'bg-rose-500 hover:bg-rose-600'
                : 'bg-sky-500 hover:bg-sky-600',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div className="text-sm text-slate-600">{message}</div>
    </ModalShell>
  );
}
