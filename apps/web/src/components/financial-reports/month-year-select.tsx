'use client';

import { buildYearOptions, joinMonth, splitMonth } from '@/lib/format-idr';
import { cn } from '@/lib/utils';

const MONTH_OPTIONS = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
] as const;

interface MonthYearSelectProps {
  /** Format YYYY-MM */
  value: string;
  onChange: (value: string) => void;
  idPrefix?: string;
  className?: string;
}

export function MonthYearSelect({
  value,
  onChange,
  idPrefix = 'period',
  className,
}: MonthYearSelectProps): JSX.Element {
  const { year, month } = splitMonth(value);
  const years = buildYearOptions();

  const selectClass = cn(
    'rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
    'focus:outline-none focus:ring-2 focus:ring-sky-400',
  );

  return (
    <div className={cn('flex flex-wrap items-end gap-3', className)}>
      <div className="flex flex-col gap-0.5">
        <label htmlFor={`${idPrefix}-month`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Bulan
        </label>
        <select
          id={`${idPrefix}-month`}
          value={month}
          onChange={(e) => onChange(joinMonth(year, Number(e.target.value)))}
          className={cn(selectClass, 'min-w-[9rem]')}
        >
          {MONTH_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-0.5">
        <label htmlFor={`${idPrefix}-year`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tahun
        </label>
        <select
          id={`${idPrefix}-year`}
          value={year}
          onChange={(e) => onChange(joinMonth(Number(e.target.value), month))}
          className={cn(selectClass, 'min-w-[6rem]')}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
