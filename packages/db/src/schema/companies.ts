import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  char,
  customType,
  index,
  smallint,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

import { eccountingSchema } from './_shared.js';
import { firms } from './firms.js';
import { users } from './users.js';

const citext = customType<{ data: string; driverData: string }>({
  dataType: () => 'citext',
});

export const companies = eccountingSchema.table(
  'companies',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    firmId: bigint('firm_id', { mode: 'bigint' })
      .notNull()
      .references(() => firms.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    npwp: varchar('npwp', { length: 20 }),
    address: text('address'),
    phone: varchar('phone', { length: 32 }),
    email: citext('email'),
    baseCurrency: char('base_currency', { length: 3 }).notNull().default('IDR'),
    fiscalYearStartMonth: smallint('fiscal_year_start_month').notNull().default(1),
    postingNumberPrefix: text('posting_number_prefix').notNull().default('JU'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdBy: bigint('created_by', { mode: 'bigint' }).references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    firmActiveIdx: index('companies_firm_active_idx').on(t.firmId),
  }),
);

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
