#!/usr/bin/env tsx
/**
 * Seed runner: load semua function SQL di seeds/*.sql (idempotent).
 *
 * Catatan: file di seeds/ adalah CREATE OR REPLACE FUNCTION definitions
 * (seperti `seed_default_coa`), bukan INSERT langsung. Yang memanggil
 * function-nya adalah aplikasi (saat onboarding company baru).
 *
 * Usage:
 *   pnpm db:seed
 *   pnpm db:seed -- --bootstrap-demo        # buat firm/company demo + run seed_default_coa
 */
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '../../..');
const SEEDS_DIR = resolve(REPO_ROOT, 'seeds');

// Load .env dari repo root, bukan dari packages/db (CWD saat pnpm --filter)
const ROOT_ENV = resolve(REPO_ROOT, '.env');
if (existsSync(ROOT_ENV)) loadEnv({ path: ROOT_ENV });

async function main(): Promise<void> {
  const url =
    process.env.DATABASE_ADMIN_URL ??
    process.env.DATABASE_URL ??
    'postgres://postgres:postgres@localhost:5432/eccounting_v2';
  const bootstrapDemo = process.argv.includes('--bootstrap-demo');

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const files = (await readdir(SEEDS_DIR)).filter((f) => f.endsWith('.sql')).sort();

    for (const filename of files) {
      const path = join(SEEDS_DIR, filename);
      const content = await readFile(path, 'utf8');
      console.info(`[seed] loading: ${filename}`);
      await client.query(content);
      console.info(`[seed] ✓ ${filename}`);
    }

    if (bootstrapDemo) {
      console.info('[seed] bootstrap-demo: insert firm + company + COA + periods');
      await client.query('BEGIN');
      try {
        const firmRes = await client.query<{ id: string }>(
          `INSERT INTO eccounting.firms (name) VALUES ('Kantor Konsultan Demo')
             ON CONFLICT DO NOTHING RETURNING id`,
        );

        const firmId = firmRes.rows[0]?.id
          ?? (await client.query<{ id: string }>(
            `SELECT id FROM eccounting.firms WHERE name = 'Kantor Konsultan Demo' LIMIT 1`,
          )).rows[0]?.id;

        if (!firmId) throw new Error('Failed to create or find demo firm');

        const userRes = await client.query<{ id: string }>(
          `INSERT INTO eccounting.users (firm_id, email, password_hash, name)
           VALUES ($1, 'demo@eccounting.local',
                   '$argon2id$v=19$m=65536,t=3,p=4$placeholder$placeholder', 'Demo User')
           ON CONFLICT (firm_id, email) DO NOTHING RETURNING id`,
          [firmId],
        );

        const userId = userRes.rows[0]?.id
          ?? (await client.query<{ id: string }>(
            `SELECT id FROM eccounting.users WHERE email = 'demo@eccounting.local' LIMIT 1`,
          )).rows[0]?.id;

        const companyRes = await client.query<{ id: string }>(
          `INSERT INTO eccounting.companies (firm_id, name, created_by)
           VALUES ($1, 'PT Demo Klien', $2)
           ON CONFLICT DO NOTHING RETURNING id`,
          [firmId, userId],
        );

        const companyId = companyRes.rows[0]?.id
          ?? (await client.query<{ id: string }>(
            `SELECT id FROM eccounting.companies WHERE firm_id = $1 AND name = 'PT Demo Klien' LIMIT 1`,
            [firmId],
          )).rows[0]?.id;

        if (!companyId) throw new Error('Failed to create or find demo company');

        await client.query(
          `INSERT INTO eccounting.company_members (company_id, user_id, role)
           VALUES ($1, $2, 'owner')
           ON CONFLICT DO NOTHING`,
          [companyId, userId],
        );

        const coaRes = await client.query<{ seed_default_coa: number }>(
          `SELECT eccounting.seed_default_coa($1::bigint)`,
          [companyId],
        );

        const periodRes = await client.query<{ bootstrap_accounting_periods: number }>(
          `SELECT eccounting.bootstrap_accounting_periods($1::bigint, EXTRACT(YEAR FROM now())::smallint)`,
          [companyId],
        );

        await client.query('COMMIT');
        console.info(
          `[seed] demo bootstrap: firm=${firmId} user=${userId} company=${companyId} ` +
            `coa_inserted=${coaRes.rows[0]?.seed_default_coa ?? 0} ` +
            `periods_inserted=${periodRes.rows[0]?.bootstrap_accounting_periods ?? 0}`,
        );
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.info('[seed] done');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
