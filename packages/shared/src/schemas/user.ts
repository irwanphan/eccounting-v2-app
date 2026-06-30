import { z } from 'zod';

import { bigintIdSchema, isoDateTimeSchema } from './common.js';
import { companyRoleSchema } from './company.js';

const passwordFieldSchema = z
  .string()
  .min(12, 'Password minimal 12 karakter')
  .max(128, 'Password maksimal 128 karakter')
  .regex(/[a-z]/, 'Wajib mengandung huruf kecil')
  .regex(/[A-Z]/, 'Wajib mengandung huruf besar')
  .regex(/\d/, 'Wajib mengandung angka');

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
  password: passwordFieldSchema,
  name: z.string().min(1).max(200),
});

export const updateUserSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    isActive: z.boolean().optional(),
    password: passwordFieldSchema.optional(),
  })
  .refine((data) => data.name !== undefined || data.isActive !== undefined || data.password !== undefined, {
    message: 'Minimal satu field harus diisi',
  });

export const userListItemSchema = z.object({
  id: bigintIdSchema,
  email: z.string().email(),
  name: z.string(),
  isActive: z.boolean(),
  lastLoginAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  membershipCount: z.number().int().nonnegative(),
});

export const userMembershipItemSchema = z.object({
  companyId: bigintIdSchema,
  companyName: z.string(),
  role: companyRoleSchema,
});

export const addAllUserMembershipsSchema = z.object({
  role: companyRoleSchema,
});

export const bulkMembershipResultSchema = z.object({
  count: z.number().int().nonnegative(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserListItem = z.infer<typeof userListItemSchema>;
export type UserMembershipItem = z.infer<typeof userMembershipItemSchema>;
export type AddAllUserMembershipsInput = z.infer<typeof addAllUserMembershipsSchema>;
export type BulkMembershipResult = z.infer<typeof bulkMembershipResultSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
