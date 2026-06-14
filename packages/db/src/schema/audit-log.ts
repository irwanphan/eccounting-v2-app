import { bigint, bigserial, char, customType, index, jsonb, text, timestamp } from 'drizzle-orm/pg-core';

import { eccountingSchema } from './_shared.js';
import { users } from './users.js';

const inet = customType<{ data: string; driverData: string }>({
  dataType: () => 'inet',
});

export const auditLog = eccountingSchema.table(
  'audit_log',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    firmId: bigint('firm_id', { mode: 'bigint' }),
    companyId: bigint('company_id', { mode: 'bigint' }),
    actorUserId: bigint('actor_user_id', { mode: 'bigint' }).references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: bigint('entity_id', { mode: 'bigint' }),
    oldValues: jsonb('old_values'),
    newValues: jsonb('new_values'),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    requestId: text('request_id'),
    prevHash: char('prev_hash', { length: 64 }),
    rowHash: char('row_hash', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyIdx: index('audit_company_idx').on(t.companyId, t.createdAt),
    firmIdx: index('audit_firm_idx').on(t.firmId, t.createdAt),
    actorIdx: index('audit_actor_idx').on(t.actorUserId, t.createdAt),
    entityIdx: index('audit_entity_idx').on(t.entityType, t.entityId, t.createdAt),
  }),
);

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
