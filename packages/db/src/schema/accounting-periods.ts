import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  index,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { eccountingSchema } from './_shared.js';
import { companies } from './companies.js';
import { users } from './users.js';

export type PeriodStatus = 'open' | 'closed' | 'locked';

export const accountingPeriods = eccountingSchema.table(
  'accounting_periods',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    companyId: bigint('company_id', { mode: 'bigint' })
      .notNull()
      .references(() => companies.id, { onDelete: 'restrict' }),
    year: smallint('year').notNull(),
    month: smallint('month').notNull(),
    status: text('status').notNull().default('open').$type<PeriodStatus>(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedBy: bigint('closed_by', { mode: 'bigint' }).references(() => users.id),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedBy: bigint('locked_by', { mode: 'bigint' }).references(() => users.id),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    companyYearMonthUnique: uniqueIndex('accounting_periods_company_year_month_unique').on(
      t.companyId,
      t.year,
      t.month,
    ),
    companyIdx: index('accounting_periods_company_idx').on(t.companyId, t.year, t.month),
  }),
);

export type AccountingPeriod = typeof accountingPeriods.$inferSelect;
export type NewAccountingPeriod = typeof accountingPeriods.$inferInsert;
