import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type ClientActionVariant = 'select' | 'edit' | 'delete';

const VARIANT_STYLES: Record<ClientActionVariant, string> = {
  select: 'bg-emerald-500 hover:bg-emerald-600 focus-visible:ring-emerald-400',
  edit: 'bg-sky-500 hover:bg-sky-600 focus-visible:ring-sky-400',
  delete: 'bg-orange-400 hover:bg-orange-500 focus-visible:ring-orange-300',
};

interface ClientActionButtonProps {
  icon: LucideIcon;
  title: string;
  variant: ClientActionVariant;
  onClick?: () => void;
  disabled?: boolean;
}

export function ClientActionButton({
  icon: Icon,
  title,
  variant,
  onClick,
  disabled = false,
}: ClientActionButtonProps): JSX.Element {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm',
        'transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        VARIANT_STYLES[variant],
        disabled && 'cursor-not-allowed opacity-50 hover:bg-inherit',
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={2.25} />
    </button>
  );
}
