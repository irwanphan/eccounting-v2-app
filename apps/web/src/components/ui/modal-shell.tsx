'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { useModalOverlay } from '@/hooks/use-modal-overlay';
import { cn } from '@/lib/utils';

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  titleId?: string;
  children: ReactNode;
  footer?: ReactNode;
  showCloseButton?: boolean;
  maxWidthClass?: string;
  bodyClassName?: string;
  closeOnBackdrop?: boolean;
}

export function ModalShell({
  open,
  onClose,
  title,
  titleId = 'modal-title',
  children,
  footer,
  showCloseButton = true,
  maxWidthClass = 'max-w-lg',
  bodyClassName,
  closeOnBackdrop = true,
}: ModalShellProps): JSX.Element | null {
  useModalOverlay(open, onClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {closeOnBackdrop ? (
        <button
          type="button"
          className="absolute inset-0 bg-black/40"
          aria-label="Tutup dialog"
          onClick={onClose}
        />
      ) : (
        <div className="absolute inset-0 bg-black/40" aria-hidden />
      )}

      <div className="pointer-events-none relative flex h-full items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal
          aria-labelledby={titleId}
          className={cn(
            'pointer-events-auto flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-lg bg-white shadow-xl',
            maxWidthClass,
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
            <h2
              id={titleId}
              className="pr-4 text-base font-semibold uppercase tracking-wide text-slate-700"
            >
              {title}
            </h2>
            {showCloseButton && (
              <button
                type="button"
                aria-label="Tutup"
                onClick={onClose}
                className="shrink-0 rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-5', bodyClassName)}>
            {children}
          </div>

          {footer && <div className="shrink-0 border-t border-border px-6 py-4">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
