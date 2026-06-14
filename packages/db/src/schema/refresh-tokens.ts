import { type AnyPgColumn, bigint, bigserial, customType, index, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { eccountingSchema } from './_shared.js';
import { users } from './users.js';

const inet = customType<{ data: string; driverData: string }>({
  dataType: () => 'inet',
});

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

export const refreshTokens = eccountingSchema.table(
  'refresh_tokens',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    userId: bigint('user_id', { mode: 'bigint' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: bytea('token_hash').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: text('revoked_reason'),
    replacedById: bigint('replaced_by_id', { mode: 'bigint' }).references(
      (): AnyPgColumn => refreshTokens.id,
      { onDelete: 'set null' },
    ),
    userAgent: text('user_agent'),
    ipAddress: inet('ip_address'),
  },
  (t) => ({
    tokenHashUnique: uniqueIndex('refresh_tokens_token_hash_key').on(t.tokenHash),
    userActiveIdx: index('refresh_tokens_user_idx').on(t.userId),
    expiresIdx: index('refresh_tokens_expires_idx').on(t.expiresAt),
  }),
);

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
