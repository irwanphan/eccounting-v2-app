import { z } from 'zod';

/**
 * BigInt sebagai string di-wire (JSON tidak support bigint).
 * Aplikasi convert ke bigint native saat dipakai di backend.
 */
export const bigintIdSchema = z
  .union([z.string().regex(/^\d+$/), z.number().int().nonnegative()])
  .transform((v) => String(v));

export const monetaryAmountSchema = z
  .union([z.string().regex(/^-?\d+(\.\d{1,4})?$/), z.number()])
  .transform((v) => {
    if (typeof v === 'number') return v.toFixed(4);
    return v;
  });

export const isoDateSchema = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.date()])
  .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v));

export const isoDateTimeSchema = z
  .union([z.string().datetime({ offset: true }), z.date()])
  .transform((v) => (v instanceof Date ? v.toISOString() : v));

export type BigIntId = z.infer<typeof bigintIdSchema>;
export type MonetaryAmount = z.infer<typeof monetaryAmountSchema>;
export type IsoDate = z.infer<typeof isoDateSchema>;
export type IsoDateTime = z.infer<typeof isoDateTimeSchema>;
