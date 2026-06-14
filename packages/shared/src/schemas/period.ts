import { z } from 'zod';

import { bigintIdSchema, isoDateTimeSchema } from './common.js';

export const periodStatusSchema = z.enum(['open', 'closed', 'locked']);

export const accountingPeriodSchema = z.object({
  id: bigintIdSchema,
  companyId: bigintIdSchema,
  year: z.number().int().min(2000).max(2200),
  month: z.number().int().min(1).max(12),
  status: periodStatusSchema,
  closedAt: isoDateTimeSchema.nullable(),
  closedBy: bigintIdSchema.nullable(),
  lockedAt: isoDateTimeSchema.nullable(),
  lockedBy: bigintIdSchema.nullable(),
  note: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const closePeriodSchema = z.object({
  year: z.number().int().min(2000).max(2200),
  month: z.number().int().min(1).max(12),
  note: z.string().max(500).optional(),
});

export const lockPeriodSchema = closePeriodSchema;
export const reopenPeriodSchema = closePeriodSchema;

export type PeriodStatus = z.infer<typeof periodStatusSchema>;
export type AccountingPeriod = z.infer<typeof accountingPeriodSchema>;
export type ClosePeriodInput = z.infer<typeof closePeriodSchema>;
