import { z } from 'zod';

import { isoDateSchema } from './common.js';

export const incomeStatementRowSchema = z.object({
  code: z.string(),
  name: z.string(),
  amount: z.string(),
});

export const incomeStatementTableBlockSchema = z.object({
  kind: z.literal('table'),
  title: z.string(),
  rows: z.array(incomeStatementRowSchema),
  total: z.string(),
});

export const incomeStatementHeadingBlockSchema = z.object({
  kind: z.literal('heading'),
  label: z.string(),
});

export const incomeStatementSummaryBlockSchema = z.object({
  kind: z.literal('summary'),
  label: z.string(),
  amount: z.string(),
});

export const incomeStatementBlockSchema = z.discriminatedUnion('kind', [
  incomeStatementHeadingBlockSchema,
  incomeStatementTableBlockSchema,
  incomeStatementSummaryBlockSchema,
]);

export const incomeStatementReportSchema = z.object({
  dateStart: isoDateSchema,
  dateEnd: isoDateSchema,
  blocks: z.array(incomeStatementBlockSchema),
});

export type IncomeStatementRow = z.infer<typeof incomeStatementRowSchema>;
export type IncomeStatementBlock = z.infer<typeof incomeStatementBlockSchema>;
export type IncomeStatementReport = z.infer<typeof incomeStatementReportSchema>;
