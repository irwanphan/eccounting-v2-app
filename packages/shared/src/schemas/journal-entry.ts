import { z } from 'zod';

import {
  bigintIdSchema,
  isoDateSchema,
  isoDateTimeSchema,
  monetaryAmountSchema,
} from './common.js';

export const journalSourceSchema = z.enum([
  'manual',
  'cash',
  'import',
  'reversal',
  'adjustment',
  'opening',
  'closing',
  'system',
]);

export const journalLineSchema = z.object({
  id: bigintIdSchema,
  journalEntryId: bigintIdSchema,
  companyId: bigintIdSchema,
  accountId: bigintIdSchema,
  lineNo: z.number().int().min(1),
  debit: monetaryAmountSchema,
  credit: monetaryAmountSchema,
  reference: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: isoDateTimeSchema,
});

export const journalEntrySchema = z.object({
  id: bigintIdSchema,
  companyId: bigintIdSchema,
  postingNumber: z.string(),
  postingDate: isoDateSchema,
  transactionDate: isoDateSchema,
  description: z.string().nullable(),
  source: journalSourceSchema,
  reversalOfId: bigintIdSchema.nullable(),
  importBatchId: bigintIdSchema.nullable(),
  createdBy: bigintIdSchema,
  createdAt: isoDateTimeSchema,
  lines: z.array(journalLineSchema).optional(),
});

/**
 * Input untuk posting jurnal manual. Validasi:
 *   - Minimal 2 lines.
 *   - Setiap line: tepat satu sisi terisi (debit XOR credit), nilai >= 0.
 *   - Total debit harus sama dengan total credit.
 */
export const createJournalEntrySchema = z
  .object({
    postingDate: isoDateSchema,
    transactionDate: isoDateSchema.optional(),
    description: z.string().max(500).optional(),
    source: journalSourceSchema.default('manual'),
    reversalOfId: bigintIdSchema.optional(),
    lines: z
      .array(
        z.object({
          accountId: bigintIdSchema,
          debit: monetaryAmountSchema.default('0'),
          credit: monetaryAmountSchema.default('0'),
          reference: z.string().max(200).optional(),
          description: z.string().max(500).optional(),
        }),
      )
      .min(2, 'Jurnal harus memiliki minimal 2 lines'),
  })
  .superRefine((data, ctx) => {
    let totalDebit = 0n;
    let totalCredit = 0n;
    for (const [i, line] of data.lines.entries()) {
      const d = toBigIntMicro(line.debit);
      const c = toBigIntMicro(line.credit);

      if ((d === 0n && c === 0n) || (d > 0n && c > 0n)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['lines', i],
          message: 'Line harus mengisi salah satu (debit XOR credit) dengan nilai > 0',
        });
      }
      if (d < 0n || c < 0n) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['lines', i],
          message: 'Debit dan credit tidak boleh negatif',
        });
      }
      totalDebit += d;
      totalCredit += c;
    }

    if (totalDebit !== totalCredit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lines'],
        message: `Jurnal tidak balance: total debit ${formatMicro(totalDebit)} ≠ total credit ${formatMicro(totalCredit)}`,
      });
    }
    if (totalDebit === 0n) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lines'],
        message: 'Jurnal tidak boleh ber-total nol',
      });
    }
  });

export const reverseJournalEntrySchema = z.object({
  reason: z.string().min(1).max(500),
  postingDate: isoDateSchema.optional(),
});

function toBigIntMicro(value: string): bigint {
  // 4 desimal → multiply by 10000
  const [intPart = '0', frac = ''] = value.split('.');
  const sign = intPart.startsWith('-') ? -1n : 1n;
  const intAbs = intPart.replace(/^-/, '');
  const fracPadded = (frac + '0000').slice(0, 4);
  return sign * (BigInt(intAbs) * 10000n + BigInt(fracPadded || '0'));
}

function formatMicro(micro: bigint): string {
  const neg = micro < 0n ? '-' : '';
  const abs = micro < 0n ? -micro : micro;
  const intPart = abs / 10000n;
  const fracPart = abs % 10000n;
  return `${neg}${intPart}.${fracPart.toString().padStart(4, '0')}`;
}

export type JournalSource = z.infer<typeof journalSourceSchema>;
export type JournalLine = z.infer<typeof journalLineSchema>;
export type JournalEntry = z.infer<typeof journalEntrySchema>;
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
export type ReverseJournalEntryInput = z.infer<typeof reverseJournalEntrySchema>;
