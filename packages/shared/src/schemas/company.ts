import { z } from 'zod';

import { bigintIdSchema, isoDateTimeSchema } from './common.js';

export const companyRoleSchema = z.enum(['owner', 'accountant', 'viewer']);

export const companySchema = z.object({
  id: bigintIdSchema,
  firmId: bigintIdSchema,
  name: z.string().min(1).max(200),
  npwp: z.string().min(15).max(20).nullable(),
  address: z.string().max(500).nullable(),
  phone: z.string().max(32).nullable(),
  email: z.string().email().nullable(),
  baseCurrency: z.string().length(3).default('IDR'),
  fiscalYearStartMonth: z.number().int().min(1).max(12).default(1),
  postingNumberPrefix: z.string().min(1).max(16).default('JU'),
  archivedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const createCompanySchema = z.object({
  name: z.string().min(1).max(200),
  npwp: z.string().min(15).max(20).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(32).optional(),
  email: z.string().email().optional(),
  baseCurrency: z.string().length(3).default('IDR'),
  fiscalYearStartMonth: z.number().int().min(1).max(12).default(1),
  postingNumberPrefix: z.string().min(1).max(16).default('JU'),
  /**
   * Saat true, otomatis seed COA default Indonesia + bootstrap accounting_periods
   * untuk tahun fiskal berjalan.
   */
  seedDefaultCoa: z.boolean().default(true),
});

export const companyMemberSchema = z.object({
  companyId: bigintIdSchema,
  userId: bigintIdSchema,
  role: companyRoleSchema,
  createdAt: isoDateTimeSchema,
});

export const addCompanyMemberSchema = z.object({
  userId: bigintIdSchema,
  role: companyRoleSchema,
});

export type CompanyRole = z.infer<typeof companyRoleSchema>;
export type Company = z.infer<typeof companySchema>;
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type CompanyMember = z.infer<typeof companyMemberSchema>;
export type AddCompanyMemberInput = z.infer<typeof addCompanyMemberSchema>;
