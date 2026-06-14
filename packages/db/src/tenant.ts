import { sql } from 'drizzle-orm';

import type { Database, Transaction } from './client.js';

/**
 * Set tenant context untuk Row-Level Security pada satu transaction.
 *
 * Wajib dipanggil di awal setiap transaction yang menyentuh data tenant.
 * `SET LOCAL` otomatis cleared saat transaction commit/rollback.
 */
export async function setTenantContext(tx: Transaction, companyId: bigint | number): Promise<void> {
  await tx.execute(sql`SET LOCAL app.company_id = ${String(companyId)}`);
}

/**
 * Reset tenant context (jarang dibutuhkan karena LOCAL auto-cleared).
 */
export async function resetTenantContext(tx: Transaction): Promise<void> {
  await tx.execute(sql`RESET app.company_id`);
}

/**
 * Helper: jalankan callback di dalam transaction dengan tenant context sudah di-set.
 *
 * @example
 * await withTenant(db, companyId, async (tx) => {
 *   return tx.select().from(journalEntries).where(...);
 * });
 */
export async function withTenant<T>(
  db: Database,
  companyId: bigint | number,
  callback: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await setTenantContext(tx, companyId);
    return callback(tx);
  });
}
