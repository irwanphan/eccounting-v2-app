import {
  bigint,
  bigserial,
  date,
  index,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

import { eccountingSchema } from './_shared.js';
import { companies } from './companies.js';
import { users } from './users.js';

export type JournalSource =
  | 'manual'
  | 'cash'
  | 'import'
  | 'reversal'
  | 'adjustment'
  | 'opening'
  | 'closing'
  | 'system';

export const journalEntries = eccountingSchema.table(
  'journal_entries',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    companyId: bigint('company_id', { mode: 'bigint' })
      .notNull()
      .references(() => companies.id, { onDelete: 'restrict' }),
    postingNumber: text('posting_number').notNull(),
    postingDate: date('posting_date', { mode: 'string' }).notNull(),
    transactionDate: date('transaction_date', { mode: 'string' }).notNull(),
    description: text('description'),
    source: text('source').notNull().$type<JournalSource>(),
    reversalOfId: bigint('reversal_of_id', { mode: 'bigint' }).references(
      (): AnyPgColumn => journalEntries.id,
    ),
    importBatchId: bigint('import_batch_id', { mode: 'bigint' }),
    legacyV1GroupJournalId: bigint('legacy_v1_group_journal_id', { mode: 'bigint' }),
    createdBy: bigint('created_by', { mode: 'bigint' })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyPostingNumberUnique: uniqueIndex('je_company_posting_number_unique').on(
      t.companyId,
      t.postingNumber,
    ),
    companyPostingDateIdx: index('je_company_posting_date_idx').on(t.companyId, t.postingDate),
    companyTransactionDateIdx: index('je_company_transaction_date_idx').on(
      t.companyId,
      t.transactionDate,
    ),
    companySourceIdx: index('je_company_source_idx').on(t.companyId, t.source),
  }),
);

export type JournalEntry = typeof journalEntries.$inferSelect;
export type NewJournalEntry = typeof journalEntries.$inferInsert;
