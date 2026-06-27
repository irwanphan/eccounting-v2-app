'use client';

import { Check, ChevronDown, Search } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Teks tambahan untuk pencarian (default: label) */
  searchText?: string;
  disabled?: boolean;
  /** Indent visual untuk hierarki (mis. COA level) */
  indent?: number;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  noResultsMessage?: string;
  disabled?: boolean;
  loading?: boolean;
  id?: string;
  className?: string;
  triggerClassName?: string;
  /** Label di atas trigger (opsional) */
  label?: ReactNode;
}

function normalizeSearch(text: string): string {
  return text.trim().toLowerCase();
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Pilih…',
  searchPlaceholder = 'Cari…',
  emptyMessage = 'Tidak ada pilihan',
  noResultsMessage = 'Tidak ditemukan',
  disabled = false,
  loading = false,
  id,
  className,
  triggerClassName,
  label,
}: SearchableSelectProps): JSX.Element {
  const autoId = useId();
  const controlId = id ?? autoId;
  const listboxId = `${controlId}-listbox`;
  const searchId = `${controlId}-search`;

  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);

  const selected = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return options;
    return options.filter((opt) => {
      const haystack = normalizeSearch(opt.searchText ?? opt.label);
      return haystack.includes(q);
    });
  }, [options, query]);

  const selectableIndices = useMemo(
    () =>
      filtered
        .map((opt, index) => (opt.disabled ? -1 : index))
        .filter((index) => index >= 0),
    [filtered],
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setHighlightIndex(0);
  }, []);

  const openDropdown = useCallback(() => {
    if (disabled || loading) return;
    setQuery('');
    setOpen(true);

    const selectedIndex = options.findIndex((opt) => opt.value === value && !opt.disabled);
    if (selectedIndex >= 0) {
      const selectableOnly = options
        .map((opt, index) => (opt.disabled ? -1 : index))
        .filter((index) => index >= 0);
      const pos = selectableOnly.indexOf(selectedIndex);
      setHighlightIndex(pos >= 0 ? pos : 0);
    } else {
      setHighlightIndex(0);
    }
  }, [disabled, loading, options, value]);

  const selectByHighlight = useCallback(
    (index: number) => {
      const filteredIndex = selectableIndices[index];
      if (filteredIndex === undefined) return;
      const opt = filtered[filteredIndex];
      if (!opt || opt.disabled) return;
      onChange(opt.value);
      close();
    },
    [close, filtered, onChange, selectableIndices],
  );

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) close();
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [close, open]);

  useEffect(() => {
    if (highlightIndex >= selectableIndices.length) {
      setHighlightIndex(Math.max(0, selectableIndices.length - 1));
    }
  }, [highlightIndex, selectableIndices.length]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const filteredIndex = selectableIndices[highlightIndex];
    if (filteredIndex === undefined) return;
    const item = listRef.current.querySelector<HTMLElement>(`[data-index="${filteredIndex}"]`);
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, open, selectableIndices]);

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (disabled || loading) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      openDropdown();
    }
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, selectableIndices.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      selectByHighlight(highlightIndex);
    }
  }

  const triggerText = loading
    ? 'Memuat…'
    : selected?.label ?? (options.length === 0 ? emptyMessage : placeholder);

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      {label && (
        <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      )}

      <button
        type="button"
        id={controlId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled || loading}
        onClick={() => (open ? close() : openDropdown())}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm shadow-sm transition',
          'hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40',
          'disabled:cursor-not-allowed disabled:opacity-60',
          !selected && !loading && options.length > 0 && 'text-muted-foreground',
          triggerClassName,
        )}
      >
        <span className="truncate">{triggerText}</span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={searchRef}
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightIndex(0);
              }}
              onKeyDown={onSearchKeyDown}
              placeholder={searchPlaceholder}
              aria-controls={listboxId}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={controlId}
            className="max-h-60 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">{noResultsMessage}</li>
            ) : (
              filtered.map((opt, index) => {
                const selectablePos = selectableIndices.indexOf(index);
                const isHighlighted = selectablePos === highlightIndex;
                const isSelected = opt.value === value;

                return (
                  <li
                    key={opt.value}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled || undefined}
                    onMouseEnter={() => {
                      if (!opt.disabled && selectablePos >= 0) setHighlightIndex(selectablePos);
                    }}
                    onClick={() => {
                      if (!opt.disabled) onChange(opt.value);
                      close();
                    }}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm',
                      opt.disabled && 'cursor-not-allowed opacity-50',
                      isHighlighted && 'bg-sky-100',
                      isSelected && !isHighlighted && 'bg-slate-50',
                    )}
                    style={{ paddingLeft: `${12 + (opt.indent ?? 0) * 12}px` }}
                  >
                    <Check
                      className={cn('h-4 w-4 shrink-0 text-sky-600', isSelected ? 'opacity-100' : 'opacity-0')}
                      aria-hidden
                    />
                    <span className="truncate">{opt.label}</span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
