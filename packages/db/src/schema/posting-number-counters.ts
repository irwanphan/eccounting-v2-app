import { sql } from 'drizzle-orm';
import { bigint, char, integer, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

import { companies } from './companies.js';
import { eccountingSchema } from './_shared.js';

export const postingNumberCounters = eccountingSchema.table(
  'posting_number_counters',
  {
    companyId: bigint('company_id', { mode: 'bigint' })
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    yyyymm: char('yyyymm', { length: 6 }).notNull(),
    prefix: text('prefix').notNull().default('JU'),
    lastValue: integer('last_value').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    pk: primaryKey({ name: 'posting_number_counters_pk', columns: [t.companyId, t.yyyymm] }),
  }),
);

export type PostingNumberCounter = typeof postingNumberCounters.$inferSelect;
export type NewPostingNumberCounter = typeof postingNumberCounters.$inferInsert;
