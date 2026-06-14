import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';

import * as schema from './schema/index.js';

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface CreateDatabaseOptions extends PoolConfig {
  connectionString?: string;
  searchPath?: string[];
}

export function createPool(options: CreateDatabaseOptions): Pool {
  const pool = new Pool({
    ...options,
    application_name: options.application_name ?? 'eccounting-v2',
  });

  if (options.searchPath?.length) {
    const searchPath = options.searchPath.join(', ');
    pool.on('connect', (client) => {
      client.query(`SET search_path TO ${searchPath}`).catch((error) => {
        console.error('Failed to set search_path', error);
      });
    });
  }

  return pool;
}

export function createDatabase(pool: Pool): Database {
  return drizzle(pool, { schema, logger: process.env.DB_LOG === 'true' });
}

export function createDatabaseFromUrl(connectionString: string): { pool: Pool; db: Database } {
  const pool = createPool({ connectionString, searchPath: ['eccounting', 'public'] });
  return { pool, db: createDatabase(pool) };
}
