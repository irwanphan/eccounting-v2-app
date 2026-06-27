/** Format angka ke gaya Indonesia (1.234.567,89) — setara v1 number_format */
export function formatIdrAmount(value: string | number): string {
  const num = typeof value === 'number' ? value : Number.parseFloat(value);
  if (Number.isNaN(num)) return '0,00';
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/** Default bulan berjalan (format input type=month YYYY-MM) */
export function defaultMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** YYYY-MM → label "Jan 2025" */
export function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  if (!y || !m) return month;
  const date = new Date(Number(y), Number(m) - 1, 1);
  return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(date);
}

/** Default tanggal awal bulan & akhir bulan (format input type=date YYYY-MM-DD) */
export function defaultMonthDateRange(): { dateStart: string; dateEnd: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const dateStart = new Date(year, month, 1);
  const dateEnd = new Date(year, month + 1, 0);
  return {
    dateStart: toIsoDate(dateStart),
    dateEnd: toIsoDate(dateEnd),
  };
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Tampilkan YYYY-MM-DD sebagai DD-MM-YYYY (dekat v1 flatpickr) */
export function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}
