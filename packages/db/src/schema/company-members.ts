import { bigint, index, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

import { eccountingSchema } from './_shared.js';
import { companies } from './companies.js';
import { users } from './users.js';

export type CompanyMemberRole = 'owner' | 'accountant' | 'viewer';

export const companyMembers = eccountingSchema.table(
  'company_members',
  {
    companyId: bigint('company_id', { mode: 'bigint' })
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    userId: bigint('user_id', { mode: 'bigint' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().$type<CompanyMemberRole>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.companyId, t.userId] }),
    userIdx: index('company_members_user_idx').on(t.userId),
  }),
);

export type CompanyMember = typeof companyMembers.$inferSelect;
export type NewCompanyMember = typeof companyMembers.$inferInsert;
