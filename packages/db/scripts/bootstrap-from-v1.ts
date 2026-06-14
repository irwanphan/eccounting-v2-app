#!/usr/bin/env tsx
/**
 * Bootstrap firm "KKP Siaw Ban Hin" + import users dari v1 MySQL ke v2 PostgreSQL.
 *
 * SHARED ONE-SHOT script — bukan bagian dari ETL data klien (yang akan dibuat
 * di apps/etl/ nanti). Tujuan: supaya kamu bisa langsung login ke v2 pakai
 * password yang sama dari v1.
 *
 * Cara kerja:
 *  1. Connect ke v1 MySQL (default: MAMP localhost:8889 db eccounting_1_prod)
 *  2. Connect ke v2 PostgreSQL (DATABASE_ADMIN_URL)
 *  3. Insert firm 1 row (jika belum ada)
 *  4. Read v1.users → insert ke v2.users dengan password_hash_algo='bcrypt'
 *     (lazy migration: pada login pertama akan auto rehash ke argon2id)
 *  5. Print ringkasan
 *
 * Run:  pnpm db:bootstrap-from-v1 [--dry-run]
 *
 * Env yang dipakai (override via .env atau CLI env):
 *   V1_MYSQL_HOST            (default: 127.0.0.1)
 *   V1_MYSQL_PORT            (default: 8889)
 *   V1_MYSQL_USER            (default: root)
 *   V1_MYSQL_PASSWORD        (default: root)
 *   V1_MYSQL_DATABASE        (default: eccounting_1_prod)
 *   FIRM_NAME                (default: KKP Siaw Ban Hin SE BKP)
 *   DATABASE_ADMIN_URL       (wajib)
 */

import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const envFile = path.join(repoRoot, '.env');
if (existsSync(envFile)) loadEnv({ path: envFile });

import mysql from 'mysql2/promise';
import { Pool } from 'pg';

interface V1User {
  id: number;
  email: string;
  name: string;
  password: string; // bcrypt $2y$...
  role_id: number | null;
  created_at: Date | null;
  updated_at: Date | null;
}

const ARGS = new Set(process.argv.slice(2));
const DRY_RUN = ARGS.has('--dry-run');

const V1_CONFIG = {
  host: process.env.V1_MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.V1_MYSQL_PORT ?? 8889),
  user: process.env.V1_MYSQL_USER ?? 'root',
  password: process.env.V1_MYSQL_PASSWORD ?? 'root',
  database: process.env.V1_MYSQL_DATABASE ?? 'eccounting_1_prod',
} as const;

const V2_ADMIN_URL =
  process.env.DATABASE_ADMIN_URL ??
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/eccounting_v2';

const FIRM_NAME = process.env.FIRM_NAME ?? 'KKP Siaw Ban Hin SE BKP';
const FIRM_TIMEZONE = process.env.FIRM_TIMEZONE ?? 'Asia/Jakarta';

async function main(): Promise<void> {
  console.log('=== Bootstrap v1 → v2 ===');
  console.log(`  v1 MySQL : ${V1_CONFIG.user}@${V1_CONFIG.host}:${V1_CONFIG.port}/${V1_CONFIG.database}`);
  console.log(`  v2 Postgres: ${V2_ADMIN_URL.replace(/:[^@]*@/, ':***@')}`);
  console.log(`  Firm name : "${FIRM_NAME}"`);
  console.log(`  Mode      : ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log();

  const v1 = await mysql.createConnection(V1_CONFIG);
  const v2 = new Pool({ connectionString: V2_ADMIN_URL });

  try {
    // 1. Read users from v1
    const [rows] = await v1.execute<mysql.RowDataPacket[]>(
      'SELECT id, email, name, password, role_id, created_at, updated_at FROM users ORDER BY id',
    );
    const v1Users = rows as unknown as V1User[];
    console.log(`Found ${v1Users.length} users in v1.users`);

    if (v1Users.length === 0) {
      console.error('No users found in v1.users — abort');
      process.exit(1);
    }

    // 2. Upsert firm
    let firmId: bigint;
    if (DRY_RUN) {
      firmId = 1n;
      console.log(`[dry-run] would insert/find firm "${FIRM_NAME}" → assume id=1`);
    } else {
      const existing = await v2.query<{ id: string }>(
        'SELECT id::text FROM eccounting.firms WHERE name = $1 LIMIT 1',
        [FIRM_NAME],
      );
      if (existing.rowCount && existing.rowCount > 0) {
        firmId = BigInt(existing.rows[0]!.id);
        console.log(`Firm already exists: id=${firmId}`);
      } else {
        const inserted = await v2.query<{ id: string }>(
          `INSERT INTO eccounting.firms (name, timezone) VALUES ($1, $2) RETURNING id::text`,
          [FIRM_NAME, FIRM_TIMEZONE],
        );
        firmId = BigInt(inserted.rows[0]!.id);
        console.log(`Inserted firm: id=${firmId}`);
      }
    }

    // 3. Import users
    let inserted = 0;
    let skipped = 0;
    for (const u of v1Users) {
      const algo = detectAlgo(u.password);
      if (!algo) {
        console.warn(`  skip user id=${u.id} (${u.email}): unknown hash format`);
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [dry-run] would insert: ${u.email} (algo=${algo})`);
        inserted++;
        continue;
      }

      const result = await v2.query(
        `
        INSERT INTO eccounting.users
          (firm_id, email, password_hash, password_hash_algo, password_changed_at,
           name, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, true, COALESCE($7, now()), COALESCE($8, now()))
        ON CONFLICT (firm_id, email) DO NOTHING
        RETURNING id::text
        `,
        [
          firmId.toString(),
          u.email.trim().toLowerCase(),
          u.password,
          algo,
          u.updated_at ?? u.created_at ?? new Date(),
          u.name,
          u.created_at,
          u.updated_at,
        ],
      );
      if (result.rowCount && result.rowCount > 0) {
        inserted++;
      } else {
        skipped++;
      }
    }

    console.log();
    console.log('=== Summary ===');
    console.log(`  Firm: "${FIRM_NAME}" (id=${firmId})`);
    console.log(`  Users inserted: ${inserted}`);
    console.log(`  Users skipped : ${skipped}`);

    if (!DRY_RUN) {
      const final = await v2.query<{ count: string }>(
        'SELECT COUNT(*)::text FROM eccounting.users WHERE firm_id = $1',
        [firmId.toString()],
      );
      console.log(`  Total users in firm: ${final.rows[0]!.count}`);
    }

    console.log();
    console.log('Login info untuk testing:');
    console.log('  - Pakai email + password lama dari v1 (bcrypt hash dimigrasikan as-is)');
    console.log('  - Pada login pertama, hash akan auto di-upgrade ke argon2id');
    console.log('  - Contoh admin: taxadmin@hiubanhin.tax');
  } finally {
    await v1.end();
    await v2.end();
  }
}

function detectAlgo(hash: string): 'bcrypt' | 'argon2id' | null {
  if (hash.startsWith('$argon2id$')) return 'argon2id';
  if (/^\$2[abxy]\$/.test(hash)) return 'bcrypt';
  return null;
}

main().catch((err) => {
  console.error('bootstrap-from-v1 failed', err);
  process.exit(1);
});
