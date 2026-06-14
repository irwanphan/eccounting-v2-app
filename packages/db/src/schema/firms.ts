import { sql } from 'drizzle-orm';
import { bigserial, text, varchar, timestamp } from 'drizzle-orm/pg-core';
import { customType } from 'drizzle-orm/pg-core';

import { eccountingSchema } from './_shared.js';

const citext = customType<{ data: string; driverData: string }>({
  dataType: () => 'citext',
});

export const firms = eccountingSchema.table('firms', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  name: text('name').notNull(),
  npwp: varchar('npwp', { length: 20 }),
  address: text('address'),
  phone: varchar('phone', { length: 32 }),
  email: citext('email'),
  timezone: text('timezone').notNull().default('Asia/Jakarta'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type Firm = typeof firms.$inferSelect;
export type NewFirm = typeof firms.$inferInsert;
