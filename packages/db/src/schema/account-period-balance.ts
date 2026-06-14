import {
  bigint,
  boolean,
  index,
  numeric,
  primaryKey,
  smallint,
  timestamp,
} from 'drizzle-orm/pg-core';

import { accounts } from './accounts.js';
import { companies } from './companies.js';
import { eccountingSchema } from './_shared.js';

export const accountPeriodBalance = eccountingSchema.table(
  'account_period_balance',
  {
    companyId: bigint('company_id', { mode: 'bigint' })
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    accountId: bigint('account_id', { mode: 'bigint' })
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    year: smallint('year').notNull(),
    month: smallint('month').notNull(),
    opening: numeric('opening', { precision: 20, scale: 4 }).notNull().default('0'),
    debitTotal: numeric('debit_total', { precision: 20, scale: 4 }).notNull().default('0'),
    creditTotal: numeric('credit_total', { precision: 20, scale: 4 }).notNull().default('0'),
    closing: numeric('closing', { precision: 20, scale: 4 }).notNull().default('0'),
    isDirty: boolean('is_dirty').notNull().default(false),
    refreshedAt: timestamp('refreshed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({
      name: 'account_period_balance_pk',
      columns: [t.companyId, t.accountId, t.year, t.month],
    }),
    companyPeriodIdx: index('apb_company_period_idx').on(t.companyId, t.year, t.month),
  }),
);

export type AccountPeriodBalance = typeof accountPeriodBalance.$inferSelect;
export type NewAccountPeriodBalance = typeof accountPeriodBalance.$inferInsert;
