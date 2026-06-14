import { z } from 'zod';

import { bigintIdSchema, isoDateTimeSchema } from './common.js';

export const userSchema = z.object({
  id: bigintIdSchema,
  firmId: bigintIdSchema,
  email: z.string().email(),
  name: z.string().min(1).max(200),
  isActive: z.boolean(),
  lastLoginAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(12, 'Password minimal 12 karakter')
    .max(128, 'Password maksimal 128 karakter')
    .regex(/[a-z]/, 'Wajib mengandung huruf kecil')
    .regex(/[A-Z]/, 'Wajib mengandung huruf besar')
    .regex(/\d/, 'Wajib mengandung angka'),
  name: z.string().min(1).max(200),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
