import { z } from 'zod';

import { bigintIdSchema, isoDateTimeSchema } from './common.js';

export const importBatchStatusSchema = z.enum([
  'pending',
  'processing',
  'done',
  'done_with_errors',
  'failed',
]);

export const importBatchSchema = z.object({
  id: bigintIdSchema,
  companyId: bigintIdSchema,
  fileName: z.string(),
  fileSha256: z.string().length(64),
  storageKey: z.string(),
  totalRows: z.number().int().nonnegative(),
  successRows: z.number().int().nonnegative(),
  failedRows: z.number().int().nonnegative(),
  status: importBatchStatusSchema,
  errorSummary: z.unknown().nullable(),
  createdBy: bigintIdSchema,
  createdAt: isoDateTimeSchema,
  startedAt: isoDateTimeSchema.nullable(),
  finishedAt: isoDateTimeSchema.nullable(),
});

export type ImportBatchStatus = z.infer<typeof importBatchStatusSchema>;
export type ImportBatch = z.infer<typeof importBatchSchema>;
