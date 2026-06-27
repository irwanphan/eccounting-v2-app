#!/usr/bin/env tsx
/**
 * ETL data per company dari v1 MySQL → v2 PostgreSQL.
 *
 * Phase:
 *   1. Validasi integritas v1 (balance group, orphan COA)
 *   2. Migrate COA → accounts (parent-first, legacy_v1_coa_id)
 *   3. Bootstrap accounting_periods untuk semua tahun posting
 *   4. Migrate group_journal → journal_entries + journal → journal_lines
 *
 * Usage:
 *   pnpm db:etl-company-from-v1 -- --legacy-v1-client-id=42
 *   pnpm db:etl-company-from-v1 -- --legacy-v1-client-id=42 --dry-run
 *   pnpm db:etl-company-from-v1 -- --legacy-v1-client-id=42 --coa-only
 *   pnpm db:etl-company-from-v1 -- --legacy-v1-client-id=42 --journals-only --limit=100
 *
 * Env: sama dengan bootstrap-from-v1 (V1_MYSQL_*, DATABASE_ADMIN_URL)
 */

import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import mysql from 'mysql2/promise';
import { Pool } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const envFile = path.join(repoRoot, '.env');
if (existsSync(envFile)) loadEnv({ path: envFile });

type AccountCategory =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'REVENUE'
  | 'EXPENSE'
  | 'COGS'
  | 'OTHER_INCOME'
  | 'OTHER_EXPENSE'
  | 'TAX_EXPENSE';

interface CliOptions {
  legacyV1ClientId: number;
  dryRun: boolean;
  coaOnly: boolean;
  journalsOnly: boolean;
  skipValidation: boolean;
  batchSize: number;
  limit: number | null;
}

interface V1Coa {
  id: number;
  parent_id: number | null;
  code: string;
  name: string;
  category_id: number | null;
  is_debet: number;
  is_last: number;
  deleted_at: Date | null;
}

interface V1GroupJournal {
  id: number;
  id_show: string;
  posting_date: string;
  note: string | null;
  batch_import_id: number | null;
}

interface V1JournalLine {
  id: number;
  group_journal_id: number;
  coa_id: number;
  transaction_date: string;
  debet: string;
  credit: string;
  reference: string | null;
  desc: string | null;
}

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

async function withPgClient<T>(pool: Pool, fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('SET search_path TO eccounting, public');
    return await fn(client);
  } finally {
    client.release();
  }
}

async function pgQuery<T extends import('pg').QueryResultRow>(
  pool: Pool,
  queryText: string,
  params?: unknown[],
): Promise<import('pg').QueryResult<T>> {
  return withPgClient(pool, (client) => client.query<T>(queryText, params));
}

const V1_CATEGORY_MAP: Record<number, AccountCategory> = {
  1: 'REVENUE',
  2: 'REVENUE',
  3: 'OTHER_INCOME',
  4: 'COGS',
  5: 'EXPENSE',
  6: 'EXPENSE',
  7: 'OTHER_EXPENSE',
  8: 'TAX_EXPENSE',
};

function parseCli(): CliOptions {
  const args = process.argv.slice(2);
  const legacyArg = args.find((a) => a.startsWith('--legacy-v1-client-id='));
  if (!legacyArg) {
    console.error('Missing required flag: --legacy-v1-client-id=<number>');
    process.exit(1);
  }
  const legacyV1ClientId = Number(legacyArg.slice('--legacy-v1-client-id='.length));
  if (!Number.isFinite(legacyV1ClientId) || legacyV1ClientId <= 0) {
    console.error('Invalid --legacy-v1-client-id');
    process.exit(1);
  }

  const batchArg = args.find((a) => a.startsWith('--batch-size='));
  const limitArg = args.find((a) => a.startsWith('--limit='));

  return {
    legacyV1ClientId,
    dryRun: args.includes('--dry-run'),
    coaOnly: args.includes('--coa-only'),
    journalsOnly: args.includes('--journals-only'),
    skipValidation: args.includes('--skip-validation'),
    batchSize: batchArg ? Math.max(1, Number(batchArg.slice('--batch-size='.length))) : 100,
    limit: limitArg ? Math.max(1, Number(limitArg.slice('--limit='.length))) : null,
  };
}

function toAmount(val: string | null | undefined): string {
  if (val == null || val === '') return '0';
  return val;
}

function postingNumberForGroup(g: V1GroupJournal): string {
  return g.id_show.trim();
}

function inferCategoryFromCode(code: string): AccountCategory {
  const head = code.trim().charAt(0);
  switch (head) {
    case '1':
      return 'ASSET';
    case '2':
      return 'LIABILITY';
    case '3':
      return 'EQUITY';
    case '4':
      return 'REVENUE';
    case '5':
      return 'COGS';
    case '6':
      return 'EXPENSE';
    case '7':
      return 'OTHER_INCOME';
    case '8':
      return 'OTHER_EXPENSE';
    case '9':
      return 'TAX_EXPENSE';
    default:
      return 'EXPENSE';
  }
}

function resolveCategory(coa: V1Coa): AccountCategory {
  if (coa.category_id != null && V1_CATEGORY_MAP[coa.category_id]) {
    return V1_CATEGORY_MAP[coa.category_id]!;
  }
  return inferCategoryFromCode(coa.code);
}

function sortCoaParentFirst(coas: V1Coa[]): V1Coa[] {
  const byId = new Map(coas.map((c) => [c.id, c]));
  const sorted: V1Coa[] = [];
  const done = new Set<number>();

  while (sorted.length < coas.length) {
    let progress = false;
    for (const coa of coas) {
      if (done.has(coa.id)) continue;
      const parentReady =
        coa.parent_id == null || done.has(coa.parent_id) || !byId.has(coa.parent_id);
      if (parentReady) {
        sorted.push(coa);
        done.add(coa.id);
        progress = true;
      }
    }
    if (!progress) {
      throw new Error('COA cycle or orphan parent detected in v1 coa tree');
    }
  }
  return sorted;
}

async function validateV1(
  v1: mysql.Connection,
  legacyV1ClientId: number,
): Promise<{ coaCount: number; groupCount: number; lineCount: number }> {
  const [imbalanceRows] = await v1.execute<mysql.RowDataPacket[]>(
    `
    SELECT gj.id, gj.id_show,
           COALESCE(SUM(j.debet), 0) - COALESCE(SUM(j.credit), 0) AS imbalance
      FROM group_journal gj
      JOIN journal j ON j.group_journal_id = gj.id
     WHERE gj.client_id = ?
     GROUP BY gj.id, gj.id_show
    HAVING ABS(COALESCE(SUM(j.debet), 0) - COALESCE(SUM(j.credit), 0)) > 0.01
    LIMIT 20
    `,
    [legacyV1ClientId],
  );

  if (imbalanceRows.length > 0) {
    console.error('Validation FAILED: unbalanced group_journal entries:');
    for (const row of imbalanceRows) {
      console.error(`  group #${row.id} (${row.id_show}): imbalance=${row.imbalance}`);
    }
    process.exit(1);
  }

  const [orphanRows] = await v1.execute<mysql.RowDataPacket[]>(
    `
    SELECT j.id, j.coa_id
      FROM journal j
      JOIN group_journal gj ON gj.id = j.group_journal_id
      LEFT JOIN coa c ON c.id = j.coa_id AND c.client_id = gj.client_id
     WHERE gj.client_id = ?
       AND c.id IS NULL
     LIMIT 20
    `,
    [legacyV1ClientId],
  );

  if (orphanRows.length > 0) {
    console.error('Validation FAILED: journal lines with missing coa:');
    for (const row of orphanRows) {
      console.error(`  journal #${row.id}: coa_id=${row.coa_id}`);
    }
    process.exit(1);
  }

  const [[coaStat]] = await v1.execute<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM coa WHERE client_id = ?`,
    [legacyV1ClientId],
  );
  const [[groupStat]] = await v1.execute<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM group_journal WHERE client_id = ?`,
    [legacyV1ClientId],
  );
  const [[lineStat]] = await v1.execute<mysql.RowDataPacket[]>(
    `
    SELECT COUNT(*) AS cnt
      FROM journal j
      JOIN group_journal gj ON gj.id = j.group_journal_id
     WHERE gj.client_id = ?
    `,
    [legacyV1ClientId],
  );

  return {
    coaCount: Number(coaStat?.cnt ?? 0),
    groupCount: Number(groupStat?.cnt ?? 0),
    lineCount: Number(lineStat?.cnt ?? 0),
  };
}

async function resolveCompany(
  v2: Pool,
  legacyV1ClientId: number,
): Promise<{ companyId: bigint; companyName: string; createdBy: bigint }> {
  const res = await pgQuery<{ id: string; name: string; created_by: string | null }>(
    v2,
    `
    SELECT id::text, name, created_by::text
      FROM companies
     WHERE legacy_v1_client_id = $1
     LIMIT 1
    `,
    [legacyV1ClientId],
  );

  if (!res.rowCount) {
    console.error(
      `Company not found for legacy_v1_client_id=${legacyV1ClientId}. Run pnpm db:bootstrap-from-v1 first.`,
    );
    process.exit(1);
  }

  const row = res.rows[0]!;
  let createdBy = row.created_by ? BigInt(row.created_by) : null;

  if (!createdBy) {
    const admin = await pgQuery<{ id: string }>(v2, `SELECT id::text FROM users ORDER BY id LIMIT 1`);
    createdBy = BigInt(admin.rows[0]!.id);
  }

  return {
    companyId: BigInt(row.id),
    companyName: row.name,
    createdBy,
  };
}

async function migrateCoa(
  v1: mysql.Connection,
  v2: Pool,
  opts: CliOptions,
  companyId: bigint,
): Promise<Map<number, bigint>> {
  const [rows] = await v1.execute<mysql.RowDataPacket[]>(
    `
    SELECT id, parent_id, code, name, category_id, is_debet, is_last, deleted_at
      FROM coa
     WHERE client_id = ?
     ORDER BY id
    `,
    [opts.legacyV1ClientId],
  );
  const coas = rows as unknown as V1Coa[];
  const ordered = sortCoaParentFirst(coas);

  const [lrpbRows] = await v1.execute<mysql.RowDataPacket[]>(
    `
    SELECT coa_id FROM coa_special_case
     WHERE client_id = ? AND type = 'LABA_RUGI_PERIODE_BERJALAN'
    `,
    [opts.legacyV1ClientId],
  );
  const retainedCoaIds = new Set(lrpbRows.map((r) => Number(r.coa_id)));

  const accountIdByV1CoaId = new Map<number, bigint>();
  let inserted = 0;
  let skipped = 0;

  if (opts.dryRun) {
    console.log(`[dry-run] would migrate ${ordered.length} COA accounts`);
    for (const coa of ordered) {
      accountIdByV1CoaId.set(coa.id, BigInt(coa.id));
    }
    return accountIdByV1CoaId;
  }

  const client = await v2.connect();
  try {
    await client.query('SET search_path TO eccounting, public');
    for (const coa of ordered) {
      const existing = await client.query<{ id: string }>(
        `
        SELECT id::text FROM accounts
         WHERE company_id = $1 AND legacy_v1_coa_id = $2
         LIMIT 1
        `,
        [companyId.toString(), coa.id],
      );

      if (existing.rowCount) {
        accountIdByV1CoaId.set(coa.id, BigInt(existing.rows[0]!.id));
        skipped++;
        continue;
      }

      const parentV2Id =
        coa.parent_id != null ? accountIdByV1CoaId.get(coa.parent_id) ?? null : null;

      const category = resolveCategory(coa);
      const normalBalance = coa.is_debet ? 'D' : 'C';
      const isPostable = coa.is_last === 1;
      const isRetained = retainedCoaIds.has(coa.id);

      const ins = await client.query<{ id: string }>(
        `
        INSERT INTO accounts (
          company_id, parent_id, code, name, category,
          normal_balance, is_postable, is_retained_earning, legacy_v1_coa_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (company_id, code) DO UPDATE
          SET legacy_v1_coa_id = EXCLUDED.legacy_v1_coa_id
        RETURNING id::text
        `,
        [
          companyId.toString(),
          parentV2Id?.toString() ?? null,
          coa.code.trim(),
          coa.name.trim(),
          category,
          normalBalance,
          isPostable,
          isRetained,
          coa.id,
        ],
      );

      accountIdByV1CoaId.set(coa.id, BigInt(ins.rows[0]!.id));
      inserted++;
    }

    // Pastikan akun yang dipakai jurnal tetap postable (v1 kadang posting ke parent)
    const [usedCoaRows] = await v1.execute<mysql.RowDataPacket[]>(
      `
      SELECT DISTINCT j.coa_id
        FROM journal j
        JOIN group_journal gj ON gj.id = j.group_journal_id
       WHERE gj.client_id = ?
      `,
      [opts.legacyV1ClientId],
    );
    const usedCoaIds = (usedCoaRows as { coa_id: number }[]).map((r) => r.coa_id);
    if (usedCoaIds.length > 0) {
      await client.query(
        `
        UPDATE accounts
           SET is_postable = true
         WHERE company_id = $1
           AND legacy_v1_coa_id = ANY($2::bigint[])
        `,
        [companyId.toString(), usedCoaIds],
      );
    }

    console.log(`COA: inserted=${inserted} skipped(existing)=${skipped} total=${ordered.length}`);
  } finally {
    client.release();
  }

  return accountIdByV1CoaId;
}

async function loadAccountMap(v2: Pool, companyId: bigint): Promise<Map<number, bigint>> {
  const res = await pgQuery<{ legacy_v1_coa_id: string; id: string }>(
    v2,
    `
    SELECT legacy_v1_coa_id::text, id::text
      FROM accounts
     WHERE company_id = $1 AND legacy_v1_coa_id IS NOT NULL
    `,
    [companyId.toString()],
  );
  const map = new Map<number, bigint>();
  for (const row of res.rows) {
    map.set(Number(row.legacy_v1_coa_id), BigInt(row.id));
  }
  return map;
}

async function bootstrapPeriods(
  v1: mysql.Connection,
  v2: Pool,
  opts: CliOptions,
  companyId: bigint,
): Promise<void> {
  const [yearRows] = await v1.execute<mysql.RowDataPacket[]>(
    `
    SELECT DISTINCT YEAR(posting_date) AS yr
      FROM group_journal
     WHERE client_id = ?
     ORDER BY yr
    `,
    [opts.legacyV1ClientId],
  );

  if (yearRows.length === 0) {
    console.log('No posting dates found — skipping period bootstrap');
    return;
  }

  if (opts.dryRun) {
    console.log(
      `[dry-run] would bootstrap periods for years: ${yearRows.map((r) => r.yr).join(', ')}`,
    );
    return;
  }

  for (const row of yearRows) {
    const year = Number(row.yr);
    const res = await pgQuery<{ bootstrap_accounting_periods: string }>(
      v2,
      `SELECT bootstrap_accounting_periods($1::bigint, $2::smallint)`,
      [companyId.toString(), year],
    );
    const count = res.rows[0]?.bootstrap_accounting_periods ?? '0';
    console.log(`  periods ${year}: +${count} months`);
  }
}

async function migrateJournals(
  v1: mysql.Connection,
  v2: Pool,
  opts: CliOptions,
  companyId: bigint,
  createdBy: bigint,
  accountMap: Map<number, bigint>,
): Promise<void> {
  const [[countRow]] = await v1.execute<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM group_journal WHERE client_id = ?`,
    [opts.legacyV1ClientId],
  );
  const totalGroups = opts.limit
    ? Math.min(Number(countRow?.cnt ?? 0), opts.limit)
    : Number(countRow?.cnt ?? 0);

  if (totalGroups === 0) {
    console.log('No group_journal rows to migrate');
    return;
  }

  if (opts.dryRun) {
    console.log(`[dry-run] would migrate ${totalGroups} journal groups (batch=${opts.batchSize})`);
    return;
  }

  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  let lastId = 0;
  let processed = 0;

  while (processed < totalGroups) {
    const take = Math.min(opts.batchSize, totalGroups - processed);
    const [groups] = await v1.execute<mysql.RowDataPacket[]>(
      `
      SELECT id, id_show, posting_date, note, batch_import_id
        FROM group_journal
       WHERE client_id = ? AND id > ?
       ORDER BY id
       LIMIT ${take}
      `,
      [opts.legacyV1ClientId, lastId],
    );

    if (groups.length === 0) break;

    for (const g of groups as unknown as V1GroupJournal[]) {
      lastId = g.id;
      processed++;

      const existing = await pgQuery(
        v2,
        `
        SELECT id FROM journal_entries
         WHERE company_id = $1 AND legacy_v1_group_journal_id = $2
         LIMIT 1
        `,
        [companyId.toString(), g.id],
      );
      if (existing.rowCount) {
        skipped++;
        continue;
      }

      const [lines] = await v1.execute<mysql.RowDataPacket[]>(
        `
        SELECT j.id, j.group_journal_id, j.coa_id, j.transaction_date,
               j.debet, j.credit, j.reference, j.desc
          FROM journal j
         WHERE j.group_journal_id = ?
         ORDER BY j.id
        `,
        [g.id],
      );
      const journalLines = lines as unknown as V1JournalLine[];

      if (journalLines.length < 2) {
        console.warn(`  skip group #${g.id} (${g.id_show}): fewer than 2 lines`);
        skipped++;
        continue;
      }

      const txDates = journalLines.map((l) => l.transaction_date).sort();
      const transactionDate = txDates[0]!;
      const source = g.batch_import_id != null ? 'import' : 'manual';
      let postingNumber = postingNumberForGroup(g);

      const pnDup = await pgQuery(
        v2,
        `SELECT id FROM journal_entries WHERE company_id = $1 AND posting_number = $2 LIMIT 1`,
        [companyId.toString(), postingNumber],
      );
      if (pnDup.rowCount) {
        postingNumber = `${postingNumberForGroup(g)}~v1${g.id}`;
      }

      const pgClient = await v2.connect();
      try {
        await pgClient.query('SET search_path TO eccounting, public');
        await pgClient.query('BEGIN');

        const entryRes = await pgClient.query<{ id: string }>(
          `
          INSERT INTO journal_entries (
            company_id, posting_number, posting_date, transaction_date,
            description, source, legacy_v1_group_journal_id, created_by
          ) VALUES ($1, $2, $3::date, $4::date, $5, $6, $7, $8)
          RETURNING id::text
          `,
          [
            companyId.toString(),
            postingNumber,
            g.posting_date,
            transactionDate,
            g.note?.trim() || null,
            source,
            g.id,
            createdBy.toString(),
          ],
        );
        const entryId = entryRes.rows[0]!.id;

        let lineNo = 1;
        for (const line of journalLines) {
          const accountId = accountMap.get(line.coa_id);
          if (!accountId) {
            throw new Error(`missing account mapping for v1 coa_id=${line.coa_id}`);
          }

          await pgClient.query(
            `
            INSERT INTO journal_lines (
              journal_entry_id, company_id, account_id, line_no,
              debit, credit, reference, description
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [
              entryId,
              companyId.toString(),
              accountId.toString(),
              lineNo,
              toAmount(line.debet),
              toAmount(line.credit),
              line.reference?.trim() || null,
              line.desc?.trim() || null,
            ],
          );
          lineNo++;
        }

        await pgClient.query('COMMIT');
        migrated++;
      } catch (err) {
        await pgClient.query('ROLLBACK');
        errors++;
        console.error(`  ERROR group #${g.id} (${g.id_show}):`, err instanceof Error ? err.message : err);
      } finally {
        pgClient.release();
      }

      if ((migrated + skipped + errors) % 500 === 0 && migrated + skipped + errors > 0) {
        console.log(`  progress: migrated=${migrated} skipped=${skipped} errors=${errors}`);
      }

      if (processed >= totalGroups) break;
    }

    if (processed >= totalGroups) break;
  }

  console.log(`Journals: migrated=${migrated} skipped=${skipped} errors=${errors}`);
}

async function main(): Promise<void> {
  const opts = parseCli();

  console.log('=== ETL company v1 → v2 ===');
  console.log(`  v1 client id : ${opts.legacyV1ClientId}`);
  console.log(`  v1 MySQL     : ${V1_CONFIG.user}@${V1_CONFIG.host}:${V1_CONFIG.port}/${V1_CONFIG.database}`);
  console.log(`  v2 Postgres  : ${V2_ADMIN_URL.replace(/:[^@]*@/, ':***@')}`);
  console.log(`  mode         : ${opts.dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (opts.coaOnly) console.log('  phase        : COA only');
  if (opts.journalsOnly) console.log('  phase        : journals only');
  if (opts.limit) console.log(`  limit        : ${opts.limit} groups`);
  console.log();

  const v1 = await mysql.createConnection(V1_CONFIG);
  const v2 = new Pool({ connectionString: V2_ADMIN_URL });

  try {
    const { companyId, companyName, createdBy } = await resolveCompany(v2, opts.legacyV1ClientId);
    console.log(`Target company: "${companyName}" (v2 id=${companyId}, created_by=${createdBy})`);
    console.log();

    if (!opts.skipValidation) {
      console.log('Validating v1 data...');
      const stats = await validateV1(v1, opts.legacyV1ClientId);
      console.log(
        `  OK — coa=${stats.coaCount} groups=${stats.groupCount} lines=${stats.lineCount}`,
      );
      console.log();
    }

    let accountMap = new Map<number, bigint>();

    if (!opts.journalsOnly) {
      console.log('Migrating COA...');
      accountMap = await migrateCoa(v1, v2, opts, companyId);
      console.log();
    } else {
      accountMap = await loadAccountMap(v2, companyId);
      if (accountMap.size === 0) {
        console.error('No accounts with legacy_v1_coa_id — run COA migration first');
        process.exit(1);
      }
      console.log(`Loaded ${accountMap.size} account mappings from v2`);
      console.log();
    }

    if (opts.coaOnly) {
      console.log('Done (--coa-only)');
      return;
    }

    console.log('Bootstrapping accounting periods...');
    await bootstrapPeriods(v1, v2, opts, companyId);
    console.log();

    console.log('Migrating journals...');
    await migrateJournals(v1, v2, opts, companyId, createdBy, accountMap);

    if (!opts.dryRun) {
      const summary = await pgQuery<{
        accounts: string;
        entries: string;
        lines: string;
      }>(
        v2,
        `
        SELECT
          (SELECT COUNT(*)::text FROM accounts WHERE company_id = $1) AS accounts,
          (SELECT COUNT(*)::text FROM journal_entries WHERE company_id = $1) AS entries,
          (SELECT COUNT(*)::text FROM journal_lines WHERE company_id = $1) AS lines
        `,
        [companyId.toString()],
      );
      console.log();
      console.log('=== v2 totals for company ===');
      console.log(`  accounts       : ${summary.rows[0]!.accounts}`);
      console.log(`  journal_entries: ${summary.rows[0]!.entries}`);
      console.log(`  journal_lines  : ${summary.rows[0]!.lines}`);
    }
  } finally {
    await v1.end();
    await v2.end();
  }
}

main().catch((err) => {
  console.error('etl-company-from-v1 failed', err);
  process.exit(1);
});
