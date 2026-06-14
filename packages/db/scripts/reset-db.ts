#!/usr/bin/env tsx
/**
 * Reset database: DROP SCHEMA eccounting CASCADE + recreate.
 *
 * ⚠️ DESTRUCTIVE — hanya pakai di development.
 * Untuk production, gunakan migration backward.
 *
 * Usage:
 *   pnpm db:reset                            # interaktif: minta konfirmasi
 *   pnpm db:reset -- --yes                   # skip konfirmasi
 *   pnpm db:reset -- --yes --then-migrate    # langsung run migrations setelahnya
 */
import 'dotenv/config';

import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { Client } from 'pg';

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(`${message} (ketik 'RESET' untuk konfirmasi): `);
    return answer.trim() === 'RESET';
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const skipConfirm = args.includes('--yes');
  const thenMigrate = args.includes('--then-migrate');

  const url =
    process.env.DATABASE_ADMIN_URL ??
    process.env.DATABASE_URL ??
    'postgres://postgres:postgres@localhost:5432/eccounting_v2';

  if (process.env.NODE_ENV === 'production' && !args.includes('--force-production')) {
    console.error('[reset] BLOCKED in production. Use --force-production if you really mean it.');
    process.exit(2);
  }

  console.warn(`[reset] target: ${url.replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1***$2')}`);

  if (!skipConfirm) {
    const ok = await confirm('Ini akan DROP semua data di schema "eccounting". Lanjut?');
    if (!ok) {
      console.info('[reset] cancelled');
      process.exit(0);
    }
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    console.warn('[reset] dropping schema eccounting CASCADE...');
    await client.query('DROP SCHEMA IF EXISTS eccounting CASCADE');
    console.info('[reset] ✓ schema dropped');
  } finally {
    await client.end();
  }

  if (thenMigrate) {
    console.info('[reset] running migrations...');
    execSync('pnpm migrate', { stdio: 'inherit', cwd: process.cwd() });
  }
}

main().catch((err) => {
  console.error('[reset] failed:', err);
  process.exit(1);
});
