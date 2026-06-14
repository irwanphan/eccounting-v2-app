import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { type Database, type Transaction, withTenant } from '@eccounting/db';
import type { Pool } from 'pg';

export const DRIZZLE_DB = Symbol('DRIZZLE_DB');
export const DRIZZLE_POOL = Symbol('DRIZZLE_POOL');

@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly logger = new Logger(DbService.name);

  constructor(
    @Inject(DRIZZLE_DB) public readonly db: Database,
    @Inject(DRIZZLE_POOL) private readonly pool: Pool,
  ) {}

  /**
   * Jalankan callback dengan tenant context (SET LOCAL app.company_id).
   * Otomatis dibungkus transaction.
   */
  withTenant<T>(companyId: bigint, fn: (tx: Transaction) => Promise<T>): Promise<T> {
    return withTenant(this.db, companyId, fn);
  }

  async ping(): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const res = await client.query<{ ok: number }>('SELECT 1 as ok');
      return res.rows[0]?.ok === 1;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing PostgreSQL pool...');
    await this.pool.end();
  }
}
