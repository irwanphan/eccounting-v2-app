import { z } from 'zod';

import { isoDateSchema } from './common.js';

export const balanceSheetRowSchema = z.object({
  code: z.string(),
  name: z.string(),
  level: z.number().int().min(1),
  amount: z.string().nullable(),
});

export const balanceSheetSubsectionSchema = z.object({
  name: z.string(),
  reverseCalculation: z.union([z.literal(1), z.literal(-1)]),
  rows: z.array(balanceSheetRowSchema),
  total: z.string(),
});

export const balanceSheetSectionSchema = z.object({
  name: z.string(),
  subsections: z.array(balanceSheetSubsectionSchema),
  summaryLabel: z.string(),
  summaryTotal: z.string(),
});

export const balanceSheetReportSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  dateStart: isoDateSchema,
  dateEnd: isoDateSchema,
  sections: z.array(balanceSheetSectionSchema),
});

export type BalanceSheetRow = z.infer<typeof balanceSheetRowSchema>;
export type BalanceSheetSubsection = z.infer<typeof balanceSheetSubsectionSchema>;
export type BalanceSheetSection = z.infer<typeof balanceSheetSectionSchema>;
export type BalanceSheetReport = z.infer<typeof balanceSheetReportSchema>;
