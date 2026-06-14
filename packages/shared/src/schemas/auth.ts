import { z } from 'zod';

import { bigintIdSchema, isoDateTimeSchema } from './common.js';

/**
 * Password policy: minimal 12 chars, mixed case + angka.
 * Aturan ini juga dipakai untuk register & change password & reset password.
 */
export const strongPasswordSchema = z
  .string()
  .min(12, 'Password minimal 12 karakter')
  .max(128, 'Password maksimal 128 karakter')
  .regex(/[a-z]/, 'Wajib mengandung huruf kecil')
  .regex(/[A-Z]/, 'Wajib mengandung huruf besar')
  .regex(/\d/, 'Wajib mengandung angka');

// =============================================================================
// LOGIN
// =============================================================================

export const loginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int().positive(),
  user: z.object({
    id: bigintIdSchema,
    firmId: bigintIdSchema,
    email: z.string().email(),
    name: z.string(),
  }),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;

// =============================================================================
// REFRESH TOKEN
// =============================================================================

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(10),
});

export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

// =============================================================================
// LOGOUT
// =============================================================================

export const logoutRequestSchema = z
  .object({
    refreshToken: z.string().optional(),
    allDevices: z.boolean().default(false),
  })
  .refine((d) => d.allDevices || d.refreshToken !== undefined, {
    message: 'refreshToken wajib diisi (kecuali allDevices=true)',
  });

export type LogoutRequest = z.infer<typeof logoutRequestSchema>;

// =============================================================================
// CHANGE PASSWORD (user yang sudah login)
// =============================================================================

export const changePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: strongPasswordSchema,
    newPasswordConfirm: z.string(),
  })
  .refine((d) => d.newPassword === d.newPasswordConfirm, {
    path: ['newPasswordConfirm'],
    message: 'Konfirmasi password tidak cocok',
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    path: ['newPassword'],
    message: 'Password baru harus berbeda dari password lama',
  });

export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

// =============================================================================
// REQUEST PASSWORD RESET (forgot password)
// =============================================================================

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

// =============================================================================
// CONFIRM PASSWORD RESET (lewat link di email)
// =============================================================================

export const confirmPasswordResetSchema = z
  .object({
    token: z.string().min(10),
    newPassword: strongPasswordSchema,
    newPasswordConfirm: z.string(),
  })
  .refine((d) => d.newPassword === d.newPasswordConfirm, {
    path: ['newPasswordConfirm'],
    message: 'Konfirmasi password tidak cocok',
  });

export type ConfirmPasswordResetInput = z.infer<typeof confirmPasswordResetSchema>;

// =============================================================================
// CURRENT USER (GET /v1/auth/me)
// =============================================================================

export const currentUserResponseSchema = z.object({
  id: bigintIdSchema,
  firmId: bigintIdSchema,
  email: z.string().email(),
  name: z.string(),
  isActive: z.boolean(),
  lastLoginAt: isoDateTimeSchema.nullable(),
  passwordChangedAt: isoDateTimeSchema,
  memberships: z.array(
    z.object({
      companyId: bigintIdSchema,
      companyName: z.string(),
      role: z.enum(['owner', 'accountant', 'viewer']),
    }),
  ),
});

export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;
