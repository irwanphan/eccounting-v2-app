import { z } from 'zod';

import { bigintIdSchema, isoDateTimeSchema } from './common.js';

export const accountCategorySchema = z.enum([
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
  'COGS',
  'OTHER_INCOME',
  'OTHER_EXPENSE',
  'TAX_EXPENSE',
]);

export const normalBalanceSchema = z.enum(['D', 'C']);

export const accountSchema = z.object({
  id: bigintIdSchema,
  companyId: bigintIdSchema,
  parentId: bigintIdSchema.nullable(),
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(200),
  category: accountCategorySchema,
  subCategory: z.string().max(100).nullable(),
  normalBalance: normalBalanceSchema,
  isPostable: z.boolean(),
  level: z.number().int().nonnegative(),
  path: z.string().nullable(),
  isRetainedEarning: z.boolean(),
  archivedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const createAccountSchema = z.object({
  parentId: bigintIdSchema.nullable().optional(),
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(200),
  category: accountCategorySchema,
  subCategory: z.string().max(100).optional(),
  normalBalance: normalBalanceSchema,
  isPostable: z.boolean().default(true),
});

export const updateAccountSchema = createAccountSchema.partial().extend({
  archivedAt: isoDateTimeSchema.nullable().optional(),
});

export type AccountCategory = z.infer<typeof accountCategorySchema>;
export type NormalBalance = z.infer<typeof normalBalanceSchema>;
export type Account = z.infer<typeof accountSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
