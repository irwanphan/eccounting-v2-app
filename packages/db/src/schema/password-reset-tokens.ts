import { bigint, bigserial, customType, index, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { eccountingSchema } from './_shared.js';
import { users } from './users.js';

const inet = customType<{ data: string; driverData: string }>({
  dataType: () => 'inet',
});

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

export const passwordResetTokens = eccountingSchema.table(
  'password_reset_tokens',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    userId: bigint('user_id', { mode: 'bigint' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: bytea('token_hash').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    requestedIp: inet('requested_ip'),
  },
  (t) => ({
    tokenHashUnique: uniqueIndex('password_reset_tokens_token_hash_key').on(t.tokenHash),
    userActiveIdx: index('password_reset_tokens_user_active_idx').on(t.userId),
  }),
);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
