import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { type Database, createDatabaseFromUrl } from '@eccounting/db';
import type { Pool } from 'pg';

import { DRIZZLE_DB, DRIZZLE_POOL, DbService } from './db.service';

interface PgResources {
  pool: Pool;
  db: Database;
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'PG_RESOURCES',
      inject: [ConfigService],
      useFactory: (config: ConfigService): PgResources => {
        const url = config.getOrThrow<string>('DATABASE_URL');
        return createDatabaseFromUrl(url);
      },
    },
    {
      provide: DRIZZLE_POOL,
      inject: ['PG_RESOURCES'],
      useFactory: (r: PgResources) => r.pool,
    },
    {
      provide: DRIZZLE_DB,
      inject: ['PG_RESOURCES'],
      useFactory: (r: PgResources) => r.db,
    },
    DbService,
  ],
  exports: [DRIZZLE_DB, DRIZZLE_POOL, DbService],
})
export class DbModule {}
