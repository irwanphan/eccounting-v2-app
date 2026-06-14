import { sql } from 'drizzle-orm';
import { bigint, bigserial, boolean, customType, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { eccountingSchema } from './_shared.js';
import { firms } from './firms.js';

const citext = customType<{ data: string; driverData: string }>({
  dataType: () => 'citext',
});

export const users = eccountingSchema.table(
  'users',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    firmId: bigint('firm_id', { mode: 'bigint' })
      .notNull()
      .references(() => firms.id, { onDelete: 'restrict' }),
    email: citext('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    firmEmailUnique: uniqueIndex('users_firm_email_unique').on(t.firmId, t.email),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
