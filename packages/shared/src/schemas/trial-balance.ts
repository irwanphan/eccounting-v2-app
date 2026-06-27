import { z } from 'zod';

import { isoDateSchema } from './common.js';

export const trialBalanceRowSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  level: z.number().int().min(0),
  debit: z.string(),
  credit: z.string(),
});

export const trialBalanceReportSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  dateStart: isoDateSchema,
  dateEnd: isoDateSchema,
  rows: z.array(trialBalanceRowSchema),
  totalDebit: z.string(),
  totalCredit: z.string(),
});

export type TrialBalanceRow = z.infer<typeof trialBalanceRowSchema>;
export type TrialBalanceReport = z.infer<typeof trialBalanceReportSchema>;
