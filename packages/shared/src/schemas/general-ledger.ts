import { z } from 'zod';

import { bigintIdSchema, isoDateSchema } from './common.js';
import { normalBalanceSchema } from './account.js';

export const accountOptionSchema = z.object({
  id: bigintIdSchema,
  code: z.string(),
  name: z.string(),
  level: z.number().int(),
  isPostable: z.boolean(),
});

export const generalLedgerLineSchema = z.object({
  lineNo: z.number().int(),
  transactionDate: isoDateSchema,
  postingNumber: z.string(),
  reference: z.string().nullable(),
  description: z.string().nullable(),
  amount: z.string(),
  balance: z.string(),
});

export const generalLedgerReportSchema = z.object({
  account: z.object({
    id: bigintIdSchema,
    code: z.string(),
    name: z.string(),
    normalBalance: normalBalanceSchema,
  }),
  dateStart: isoDateSchema,
  dateEnd: isoDateSchema,
  openingBalance: z.string(),
  closingBalance: z.string(),
  /** Diisi untuk akun Laba Rugi Periode Berjalan — setara baris khusus v1 sebelum Saldo Akhir */
  retainedEarningsInPeriod: z.string().nullable(),
  lines: z.array(generalLedgerLineSchema),
});

export type AccountOption = z.infer<typeof accountOptionSchema>;
export type GeneralLedgerLine = z.infer<typeof generalLedgerLineSchema>;
export type GeneralLedgerReport = z.infer<typeof generalLedgerReportSchema>;
