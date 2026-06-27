import { z } from 'zod';

import { bigintIdSchema, isoDateSchema, monetaryAmountSchema } from './common.js';
import { makeResponseListSchema } from './pagination.js';

export const journalDateRangeQuerySchema = z.object({
  dateStart: isoDateSchema,
  dateEnd: isoDateSchema,
});

export const journalGroupedRowSchema = z.object({
  id: bigintIdSchema,
  postingNumber: z.string(),
  postingDate: isoDateSchema,
  description: z.string().nullable(),
  source: z.string(),
  importBatchId: bigintIdSchema.nullable(),
  totalDebit: monetaryAmountSchema,
  totalCredit: monetaryAmountSchema,
  isImported: z.boolean(),
});

export const journalDetailRowSchema = z.object({
  id: bigintIdSchema,
  journalEntryId: bigintIdSchema,
  postingNumber: z.string(),
  postingDate: isoDateSchema,
  transactionDate: isoDateSchema,
  accountCode: z.string(),
  accountName: z.string(),
  description: z.string().nullable(),
  debit: monetaryAmountSchema,
  credit: monetaryAmountSchema,
});

export const journalLineViewSchema = z.object({
  id: bigintIdSchema,
  lineNo: z.number().int(),
  transactionDate: isoDateSchema,
  accountCode: z.string(),
  accountName: z.string(),
  reference: z.string().nullable(),
  description: z.string().nullable(),
  debit: monetaryAmountSchema,
  credit: monetaryAmountSchema,
});

export const journalGroupedListSchema = makeResponseListSchema(journalGroupedRowSchema);
export const journalDetailListSchema = makeResponseListSchema(journalDetailRowSchema);

export type JournalDateRangeQuery = z.infer<typeof journalDateRangeQuerySchema>;
export type JournalGroupedRow = z.infer<typeof journalGroupedRowSchema>;
export type JournalDetailRow = z.infer<typeof journalDetailRowSchema>;
export type JournalLineView = z.infer<typeof journalLineViewSchema>;
