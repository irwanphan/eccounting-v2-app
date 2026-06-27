import { z } from 'zod';

import { accountCategorySchema, normalBalanceSchema } from './account.js';

export const accountFlatRowSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  code: z.string(),
  name: z.string(),
  level: z.number().int().min(0),
  category: accountCategorySchema,
  subCategory: z.string().nullable(),
  normalBalance: normalBalanceSchema,
  isPostable: z.boolean(),
  isRetainedEarning: z.boolean(),
});

export interface AccountTreeNode {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  level: number;
  category: z.infer<typeof accountCategorySchema>;
  subCategory: string | null;
  normalBalance: z.infer<typeof normalBalanceSchema>;
  isPostable: boolean;
  isRetainedEarning: boolean;
  children: AccountTreeNode[];
}

export const accountTreeNodeSchema: z.ZodType<AccountTreeNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    parentId: z.string().nullable(),
    code: z.string(),
    name: z.string(),
    level: z.number().int().min(0),
    category: accountCategorySchema,
    subCategory: z.string().nullable(),
    normalBalance: normalBalanceSchema,
    isPostable: z.boolean(),
    isRetainedEarning: z.boolean(),
    children: z.array(accountTreeNodeSchema),
  }),
);

export const accountTreeResponseSchema = z.object({
  tree: z.array(accountTreeNodeSchema),
  flat: z.array(accountFlatRowSchema),
});

/** Body create/update COA — field setara v1 modal form */
export const coaFormInputSchema = z.object({
  parentId: z.string().nullable().optional(),
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(200),
  normalBalance: normalBalanceSchema,
  /** v1 coa_category.id; 0 atau null = tidak ada kategori */
  categoryId: z.number().int().min(0).max(8).optional(),
  isRetainedEarning: z.boolean().optional(),
});

export type AccountFlatRow = z.infer<typeof accountFlatRowSchema>;
export type AccountTreeResponse = z.infer<typeof accountTreeResponseSchema>;
export type CoaFormInput = z.infer<typeof coaFormInputSchema>;
