#!/usr/bin/env tsx
/**
 * Set password dev untuk 1 user (local testing only).
 *
 * Usage:
 *   pnpm db:set-dev-password
 *   pnpm db:set-dev-password -- --email=taxadmin@hiubanhin.tax --password=DevTest123!
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hash } from '@node-rs/argon2';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '../../..');
const ROOT_ENV = resolve(REPO_ROOT, '.env');
if (existsSync(ROOT_ENV)) loadEnv({ path: ROOT_ENV });

function parseArgs(): { email: string; password: string } {
  const args = process.argv.slice(2);
  const emailArg = args.find((a) => a.startsWith('--email='));
  const passwordArg = args.find((a) => a.startsWith('--password='));

  return {
    email: emailArg?.slice('--email='.length) ?? 'taxadmin@hiubanhin.tax',
    password: passwordArg?.slice('--password='.length) ?? 'DevTest123!',
  };
}

function getDbUrl(): string {
  return (
    process.env.DATABASE_ADMIN_URL ??
    process.env.DATABASE_URL ??
    'postgres://postgres:postgres@localhost:5432/eccounting_v2'
  );
}

function maskUrl(url: string): string {
  return url.replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1***$2');
}

async function main(): Promise<void> {
  const { email, password } = parseArgs();
  const url = getDbUrl();

  if (process.env.NODE_ENV === 'production') {
    console.error('[set-dev-password] BLOCKED: tidak boleh di production');
    process.exit(1);
  }

  console.log(`[set-dev-password] target: ${email}`);
  console.log(`[set-dev-password] db: ${maskUrl(url)}`);

  const passwordHash = await hash(password, {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const result = await client.query<{ id: string; email: string; name: string }>(
      `
      UPDATE eccounting.users
         SET password_hash = $1,
             password_hash_algo = 'argon2id',
             password_changed_at = now(),
             failed_login_count = 0,
             locked_until = NULL
       WHERE email = $2
       RETURNING id::text, email, name
      `,
      [passwordHash, email.trim().toLowerCase()],
    );

    if (!result.rowCount) {
      console.error(`[set-dev-password] user tidak ditemukan: ${email}`);
      console.error('  Jalankan dulu: pnpm db:bootstrap-from-v1');
      process.exit(1);
    }

    const user = result.rows[0]!;
    console.log();
    console.log('✓ Password updated');
    console.log(`  User : ${user.name} (${user.email})`);
    console.log(`  Login: ${email} / ${password}`);
    console.log();
    console.log('Test: http://localhost:3000/login');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[set-dev-password] failed:', err);
  process.exit(1);
});
