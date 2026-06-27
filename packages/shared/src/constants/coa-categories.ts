/** v1 coa_category — setara App\\Models\\CoaCategory */
export const V1_COA_CATEGORIES = [
  { id: 0, name: '-Tidak Ada Kategory-' },
  { id: 1, name: 'Pendapatan Usaha' },
  { id: 2, name: 'Pendapatan Usaha Lainnya' },
  { id: 3, name: 'Pendapatan Luar Usaha' },
  { id: 4, name: 'Harga Pokok Penjualan' },
  { id: 5, name: 'Biaya Operasional' },
  { id: 6, name: 'Biaya Non Operasional' },
  { id: 7, name: 'Biaya Luar Operasional' },
  { id: 8, name: 'Beban Pajak' },
] as const;

export type V1CoaCategoryId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Map v1 category_id → v2 accounts.category enum */
export const V1_CATEGORY_TO_ACCOUNT_CATEGORY: Record<
  Exclude<V1CoaCategoryId, 0>,
  'REVENUE' | 'OTHER_INCOME' | 'COGS' | 'EXPENSE' | 'OTHER_EXPENSE' | 'TAX_EXPENSE'
> = {
  1: 'REVENUE',
  2: 'REVENUE',
  3: 'OTHER_INCOME',
  4: 'COGS',
  5: 'EXPENSE',
  6: 'EXPENSE',
  7: 'OTHER_EXPENSE',
  8: 'TAX_EXPENSE',
};
