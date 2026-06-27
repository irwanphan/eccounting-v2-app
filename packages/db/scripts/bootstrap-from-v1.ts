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
 *  5. Read v1.client → insert ke v2.companies (legacy_v1_client_id)
 *  6. Grant semua user firm membership accountant di setiap company
 *  7. Print ringkasan
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

interface V1Client {
  id: number;
  user_id: number | null;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
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

    // 4. Import clients → companies
    const [clientRows] = await v1.execute<mysql.RowDataPacket[]>(
      `SELECT id, user_id, name, address, phone, email, created_at, updated_at
       FROM client
       WHERE deleted_at IS NULL
       ORDER BY id`,
    );
    const v1Clients = clientRows as unknown as V1Client[];
    console.log();
    console.log(`Found ${v1Clients.length} clients in v1.client (non-deleted)`);

    let companiesInserted = 0;
    let companiesUpdated = 0;
    const companyIdByV1Id = new Map<number, bigint>();

    for (const c of v1Clients) {
      if (DRY_RUN) {
        console.log(`  [dry-run] would upsert company: v1#${c.id} "${c.name}"`);
        companyIdByV1Id.set(c.id, BigInt(c.id));
        companiesInserted++;
        continue;
      }

      const existing = await v2.query<{ id: string }>(
        `SELECT id::text FROM eccounting.companies
         WHERE firm_id = $1 AND legacy_v1_client_id = $2
         LIMIT 1`,
        [firmId.toString(), c.id],
      );

      if (existing.rowCount && existing.rowCount > 0) {
        const companyId = BigInt(existing.rows[0]!.id);
        await v2.query(
          `UPDATE eccounting.companies
           SET name = $3, address = $4, phone = $5, email = $6, updated_at = COALESCE($7, now())
           WHERE id = $1 AND firm_id = $2`,
          [
            companyId.toString(),
            firmId.toString(),
            c.name.trim(),
            c.address?.trim() || null,
            c.phone?.trim() || null,
            c.email?.trim().toLowerCase() || null,
            c.updated_at,
          ],
        );
        companyIdByV1Id.set(c.id, companyId);
        companiesUpdated++;
        continue;
      }

      const insertedCompany = await v2.query<{ id: string }>(
        `
        INSERT INTO eccounting.companies
          (firm_id, name, address, phone, email, legacy_v1_client_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now()), COALESCE($8, now()))
        RETURNING id::text
        `,
        [
          firmId.toString(),
          c.name.trim(),
          c.address?.trim() || null,
          c.phone?.trim() || null,
          c.email?.trim().toLowerCase() || null,
          c.id,
          c.created_at,
          c.updated_at,
        ],
      );

      const row = insertedCompany.rows[0];
      if (!row) continue;
      companyIdByV1Id.set(c.id, BigInt(row.id));
      companiesInserted++;
    }

    // 5. Grant membership: semua user firm → accountant di setiap company
    let membershipsInserted = 0;
    if (v1Clients.length > 0) {
      const firmUsers = DRY_RUN
        ? v1Users.map((u) => ({ id: BigInt(u.id) }))
        : (
            await v2.query<{ id: string }>(
              'SELECT id::text FROM eccounting.users WHERE firm_id = $1',
              [firmId.toString()],
            )
          ).rows.map((r) => ({ id: BigInt(r.id) }));

      for (const [, companyId] of companyIdByV1Id) {
        for (const u of firmUsers) {
          if (DRY_RUN) {
            membershipsInserted++;
            continue;
          }
          const mem = await v2.query(
            `
            INSERT INTO eccounting.company_members (company_id, user_id, role)
            VALUES ($1, $2, 'accountant')
            ON CONFLICT (company_id, user_id) DO NOTHING
            RETURNING company_id
            `,
            [companyId.toString(), u.id.toString()],
          );
          if (mem.rowCount && mem.rowCount > 0) membershipsInserted++;
        }
      }
    }

    console.log();
    console.log('=== Summary ===');
    console.log(`  Firm: "${FIRM_NAME}" (id=${firmId})`);
    console.log(`  Users inserted: ${inserted}`);
    console.log(`  Users skipped : ${skipped}`);
    console.log(`  Companies inserted: ${companiesInserted}`);
    console.log(`  Companies updated : ${companiesUpdated}`);
    console.log(`  Memberships added : ${membershipsInserted}`);

    if (!DRY_RUN) {
      const final = await v2.query<{ users: string; companies: string }>(
        `SELECT
           (SELECT COUNT(*)::text FROM eccounting.users WHERE firm_id = $1) AS users,
           (SELECT COUNT(*)::text FROM eccounting.companies WHERE firm_id = $1 AND archived_at IS NULL) AS companies`,
        [firmId.toString()],
      );
      console.log(`  Total users in firm   : ${final.rows[0]!.users}`);
      console.log(`  Total companies in firm: ${final.rows[0]!.companies}`);
    }

    console.log();
    console.log('Login info untuk testing:');
    console.log('  - Pakai email + password lama dari v1 (bcrypt hash dimigrasikan as-is)');
    console.log('  - Pada login pertama, hash akan auto di-upgrade ke argon2id');
    console.log('  - Contoh admin: taxadmin@hiubanhin.tax');
    console.log('  - Setelah login v2: pilih klien dari daftar (sama seperti v1 /admin/client)');
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
