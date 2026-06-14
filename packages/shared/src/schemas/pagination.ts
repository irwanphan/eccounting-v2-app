import { z } from 'zod';

export const paginationCursorSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const paginationPageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(25),
});

export function makeResponseListSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    meta: z.object({
      nextCursor: z.string().nullable().optional(),
      total: z.number().int().nonnegative().optional(),
      page: z.number().int().min(1).optional(),
      perPage: z.number().int().min(1).optional(),
    }),
  });
}

export type PaginationCursor = z.infer<typeof paginationCursorSchema>;
export type PaginationPage = z.infer<typeof paginationPageSchema>;
