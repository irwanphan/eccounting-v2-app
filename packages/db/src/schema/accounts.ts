import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  char,
  customType,
  index,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

import { eccountingSchema } from './_shared.js';
import { companies } from './companies.js';

const ltree = customType<{ data: string; driverData: string }>({
  dataType: () => 'ltree',
});

export type AccountCategory =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'REVENUE'
  | 'EXPENSE'
  | 'COGS'
  | 'OTHER_INCOME'
  | 'OTHER_EXPENSE'
  | 'TAX_EXPENSE';

export type NormalBalance = 'D' | 'C';

export const accounts = eccountingSchema.table(
  'accounts',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    companyId: bigint('company_id', { mode: 'bigint' })
      .notNull()
      .references(() => companies.id, { onDelete: 'restrict' }),
    parentId: bigint('parent_id', { mode: 'bigint' }).references((): AnyPgColumn => accounts.id, {
      onDelete: 'restrict',
    }),
    code: varchar('code', { length: 32 }).notNull(),
    name: text('name').notNull(),
    category: text('category').notNull().$type<AccountCategory>(),
    subCategory: text('sub_category'),
    normalBalance: char('normal_balance', { length: 1 }).notNull().$type<NormalBalance>(),
    isPostable: boolean('is_postable').notNull().default(true),
    level: smallint('level').notNull().default(0),
    path: ltree('path'),
    isRetainedEarning: boolean('is_retained_earning').notNull().default(false),
    legacyV1CoaId: bigint('legacy_v1_coa_id', { mode: 'bigint' }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    companyCodeUnique: uniqueIndex('accounts_company_code_unique').on(t.companyId, t.code),
    companyParentIdx: index('accounts_company_parent_idx').on(t.companyId, t.parentId),
    companyCategoryIdx: index('accounts_company_category_idx').on(t.companyId, t.category),
  }),
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
