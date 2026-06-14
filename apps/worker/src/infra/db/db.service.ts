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

  withTenant<T>(companyId: bigint, fn: (tx: Transaction) => Promise<T>): Promise<T> {
    return withTenant(this.db, companyId, fn);
  }

  /** Untuk admin task yang lintas tenant (mis. balance refresh full). */
  rawDb(): Database {
    return this.db;
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing PostgreSQL pool...');
    await this.pool.end();
  }
}
