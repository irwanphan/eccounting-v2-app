import { z } from 'zod';

import { bigintIdSchema, isoDateTimeSchema } from './common.js';

export const firmSchema = z.object({
  id: bigintIdSchema,
  name: z.string().min(1).max(200),
  npwp: z.string().min(15).max(20).nullable(),
  address: z.string().max(500).nullable(),
  phone: z.string().max(32).nullable(),
  email: z.string().email().nullable(),
  timezone: z.string().default('Asia/Jakarta'),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type Firm = z.infer<typeof firmSchema>;
