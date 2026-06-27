#!/usr/bin/env tsx
/**
 * Migration runner: jalankan semua file migrations/*.sql secara berurutan
 * di transaction satu per satu, idempotent.
 *
 * Track yang sudah dijalankan di tabel `eccounting._migrations` (auto-created).
 *
 * Usage:
 *   pnpm db:migrate                          # jalankan semua migrasi pending
 *   DATABASE_URL=... pnpm db:migrate
 *   pnpm db:migrate -- --dry-run             # preview tanpa eksekusi
 *   pnpm db:migrate -- --to=0005             # jalankan sampai 0005 saja
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '../../..');
const MIGRATIONS_DIR = resolve(REPO_ROOT, 'migrations');

// Load .env dari repo root, bukan dari packages/db (CWD saat pnpm --filter)
const ROOT_ENV = resolve(REPO_ROOT, '.env');
if (existsSync(ROOT_ENV)) loadEnv({ path: ROOT_ENV });

interface CliArgs {
  dryRun: boolean;
  to: string | null;
  url: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const toArg = args.find((a) => a.startsWith('--to='));
  const url =
    process.env.DATABASE_ADMIN_URL ??
    process.env.DATABASE_URL ??
    'postgres://postgres:postgres@localhost:5432/eccounting_v2';
  return { dryRun, to: toArg ? toArg.slice('--to='.length) : null, url };
}

async function ensureMigrationsTable(client: Client): Promise<void> {
  await client.query(`CREATE SCHEMA IF NOT EXISTS eccounting`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS eccounting._migrations (
      filename    TEXT PRIMARY KEY,
      checksum    CHAR(64) NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function listMigrationFiles(): Promise<string[]> {
  const files = await readdir(MIGRATIONS_DIR);
  return files.filter((f) => f.endsWith('.sql')).sort();
}

async function getApplied(client: Client): Promise<Map<string, string>> {
  const res = await client.query<{ filename: string; checksum: string }>(
    `SELECT filename, checksum FROM eccounting._migrations`,
  );
  return new Map(res.rows.map((r) => [r.filename, r.checksum]));
}

function checksum(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function applyMigration(client: Client, filename: string, content: string): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(content);
    await client.query(
      `INSERT INTO eccounting._migrations (filename, checksum) VALUES ($1, $2)`,
      [filename, checksum(content)],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function main(): Promise<void> {
  const { dryRun, to, url } = parseArgs();

  console.info(`[migrate] migrations dir: ${MIGRATIONS_DIR}`);
  console.info(`[migrate] target: ${maskUrl(url)}`);
  if (dryRun) console.info(`[migrate] DRY RUN`);

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await ensureMigrationsTable(client);
    const applied = await getApplied(client);
    const files = await listMigrationFiles();

    let appliedCount = 0;
    let skippedCount = 0;

    for (const filename of files) {
      if (to && filename.replace(/_.+\.sql$/, '') > to) break;

      const content = await readFile(join(MIGRATIONS_DIR, filename), 'utf8');
      const sum = checksum(content);

      if (applied.has(filename)) {
        const prevSum = applied.get(filename);
        if (prevSum && prevSum !== sum) {
          console.warn(
            `[migrate] WARNING: ${filename} sudah applied tapi checksum berubah. ` +
              `Migration file tidak boleh diubah setelah applied.`,
          );
        }
        skippedCount++;
        continue;
      }

      if (dryRun) {
        console.info(`[migrate] WOULD APPLY: ${filename}`);
        appliedCount++;
        continue;
      }

      console.info(`[migrate] applying: ${filename}`);
      const start = Date.now();
      await applyMigration(client, filename, content);
      console.info(`[migrate] ✓ ${filename} (${Date.now() - start}ms)`);
      appliedCount++;
    }

    console.info(`[migrate] done. applied=${appliedCount} skipped=${skippedCount}`);
  } finally {
    await client.end();
  }
}

function maskUrl(url: string): string {
  return url.replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1***$2');
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
