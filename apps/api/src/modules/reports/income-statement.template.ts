import type { AccountCategory } from '@eccounting/shared';

/** v1 coa_category.id — setara App\Models\CoaCategory */
export const V1CoaCategory = {
  PENDAPATAN_USAHA: 1,
  PENDAPATAN_USAHA_LAINNYA: 2,
  PENDAPATAN_LUAR_USAHA: 3,
  HARGA_POKOK_PENJUALAN: 4,
  BIAYA_OPERASIONAL: 5,
  BIAYA_NON_OPERASIONAL: 6,
  BIAYA_LUAR_OPERASIONAL: 7,
  BEBAN_PAJAK: 8,
} as const;

export interface IncomeStatementTableDef {
  title: string;
  v1Categories: number[];
  reverseMultiplier: 1 | -1;
}

export interface IncomeStatementLayoutItem {
  type: 'heading' | 'table' | 'summary';
  label?: string;
  table?: IncomeStatementTableDef;
  totalKey?: string;
  /** Kunci total subsection — dipakai untuk menghitung summary berikutnya */
  compute?: (totals: Record<string, number>) => number;
}

/** Urutan & struktur setara v1 financial-report/laba-rugi/report.blade.php */
export const INCOME_STATEMENT_LAYOUT: IncomeStatementLayoutItem[] = [
  { type: 'heading', label: 'Laba Kotor' },
  {
    type: 'table',
    totalKey: 'pendapatanUsaha',
    table: {
      title: 'Pendapatan Usaha',
      v1Categories: [V1CoaCategory.PENDAPATAN_USAHA],
      reverseMultiplier: -1,
    },
  },
  {
    type: 'table',
    totalKey: 'hpp',
    table: {
      title: 'Harga Pokok Penjualan',
      v1Categories: [V1CoaCategory.HARGA_POKOK_PENJUALAN],
      reverseMultiplier: 1,
    },
  },
  {
    type: 'summary',
    label: 'Laba Kotor',
    compute: (t) => t.pendapatanUsaha! - t.hpp!,
  },
  {
    type: 'table',
    totalKey: 'biayaUsaha',
    table: {
      title: 'Biaya Usaha',
      v1Categories: [V1CoaCategory.BIAYA_OPERASIONAL],
      reverseMultiplier: 1,
    },
  },
  {
    type: 'summary',
    label: 'Laba Bersih Usaha',
    compute: (t) => t.pendapatanUsaha! - t.hpp! - t.biayaUsaha!,
  },
  {
    type: 'table',
    totalKey: 'pendapatanLain',
    table: {
      title: 'Pendapatan Lain-Lain',
      v1Categories: [
        V1CoaCategory.PENDAPATAN_USAHA_LAINNYA,
        V1CoaCategory.PENDAPATAN_LUAR_USAHA,
      ],
      reverseMultiplier: -1,
    },
  },
  {
    type: 'table',
    totalKey: 'biayaLain',
    table: {
      title: 'Biaya Lain-Lain',
      v1Categories: [
        V1CoaCategory.BIAYA_NON_OPERASIONAL,
        V1CoaCategory.BIAYA_LUAR_OPERASIONAL,
      ],
      reverseMultiplier: 1,
    },
  },
  {
    type: 'summary',
    label: 'Penghasilan Kena Pajak',
    compute: (t) =>
      t.pendapatanUsaha! -
      t.hpp! -
      t.biayaUsaha! +
      (t.pendapatanLain! - t.biayaLain!),
  },
  {
    type: 'table',
    totalKey: 'pajak',
    table: {
      title: 'Pajak Penghasilan',
      v1Categories: [V1CoaCategory.BEBAN_PAJAK],
      reverseMultiplier: 1,
    },
  },
  {
    type: 'summary',
    label: 'Laba Rugi Setelah Pajak',
    compute: (t) =>
      t.pendapatanUsaha! -
      t.hpp! -
      t.biayaUsaha! +
      (t.pendapatanLain! - t.biayaLain!) -
      t.pajak!,
  },
];

export interface AccountForV1Category {
  subCategory: string | null;
  category: AccountCategory;
  code: string;
}

/**
 * Resolve v1 coa_category.id untuk pengelompokan Laba Rugi.
 * Prioritas: accounts.sub_category (dari ETL) → heuristik category + kode akun.
 */
export function resolveV1IncomeCategory(account: AccountForV1Category): number | null {
  if (account.subCategory != null) {
    const parsed = Number.parseInt(account.subCategory, 10);
    if (parsed >= 1 && parsed <= 8) return parsed;
  }

  switch (account.category) {
    case 'REVENUE':
      return account.code.startsWith('41') ? 1 : 2;
    case 'OTHER_INCOME':
      return 3;
    case 'COGS':
      return 4;
    case 'EXPENSE':
      return account.code.startsWith('62') ? 6 : 5;
    case 'OTHER_EXPENSE':
      return 7;
    case 'TAX_EXPENSE':
      return 8;
    default:
      return null;
  }
}
