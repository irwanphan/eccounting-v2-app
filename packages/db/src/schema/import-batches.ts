import {
  bigint,
  bigserial,
  char,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { companies } from './companies.js';
import { eccountingSchema } from './_shared.js';
import { users } from './users.js';

export type ImportBatchStatus = 'pending' | 'processing' | 'done' | 'done_with_errors' | 'failed';

export const importBatches = eccountingSchema.table(
  'import_batches',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    companyId: bigint('company_id', { mode: 'bigint' })
      .notNull()
      .references(() => companies.id, { onDelete: 'restrict' }),
    fileName: text('file_name').notNull(),
    fileSha256: char('file_sha256', { length: 64 }).notNull(),
    storageKey: text('storage_key').notNull(),
    totalRows: integer('total_rows').notNull().default(0),
    successRows: integer('success_rows').notNull().default(0),
    failedRows: integer('failed_rows').notNull().default(0),
    status: text('status').notNull().default('pending').$type<ImportBatchStatus>(),
    errorSummary: jsonb('error_summary'),
    createdBy: bigint('created_by', { mode: 'bigint' })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => ({
    companyFileSha256Unique: uniqueIndex('import_batches_company_sha_unique').on(
      t.companyId,
      t.fileSha256,
    ),
    companyStatusIdx: index('import_batches_company_status_idx').on(
      t.companyId,
      t.status,
      t.createdAt,
    ),
  }),
);

export type ImportBatch = typeof importBatches.$inferSelect;
export type NewImportBatch = typeof importBatches.$inferInsert;
