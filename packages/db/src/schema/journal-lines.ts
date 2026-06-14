import {
  bigint,
  bigserial,
  index,
  numeric,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { accounts } from './accounts.js';
import { companies } from './companies.js';
import { eccountingSchema } from './_shared.js';
import { journalEntries } from './journal-entries.js';

export const journalLines = eccountingSchema.table(
  'journal_lines',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    journalEntryId: bigint('journal_entry_id', { mode: 'bigint' })
      .notNull()
      .references(() => journalEntries.id, { onDelete: 'restrict' }),
    companyId: bigint('company_id', { mode: 'bigint' })
      .notNull()
      .references(() => companies.id),
    accountId: bigint('account_id', { mode: 'bigint' })
      .notNull()
      .references(() => accounts.id),
    lineNo: smallint('line_no').notNull(),
    debit: numeric('debit', { precision: 20, scale: 4 }).notNull().default('0'),
    credit: numeric('credit', { precision: 20, scale: 4 }).notNull().default('0'),
    reference: text('reference'),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    entryLineNoUnique: uniqueIndex('jl_entry_line_no_unique').on(t.journalEntryId, t.lineNo),
    companyAccountIdx: index('jl_company_account_idx').on(t.companyId, t.accountId),
    entryIdx: index('jl_entry_idx').on(t.journalEntryId),
    companyAccountEntryIdx: index('jl_company_account_entry_idx').on(
      t.companyId,
      t.accountId,
      t.journalEntryId,
    ),
  }),
);

export type JournalLine = typeof journalLines.$inferSelect;
export type NewJournalLine = typeof journalLines.$inferInsert;
