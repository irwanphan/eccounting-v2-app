# Dokumentasi Eccounting v2

Folder ini berisi dokumentasi desain & strategi untuk rebuild Eccounting v2.

## Daftar dokumen

| Dokumen | Isi |
|---|---|
| [`AUDIT_REKOMENDASI_V2.md`](./AUDIT_REKOMENDASI_V2.md) | Audit codebase v1 (19 bug + severity), prinsip wajib aplikasi akuntansi, rekomendasi stack awal, rencana migrasi 6 fase, quick wins v1 |
| [`NESTJS_RATIONALE.md`](./NESTJS_RATIONALE.md) | Alasan teknis & bisnis pakai NestJS (vs Next.js as backend), 12 alasan konkret, struktur folder usulan |
| [`API_STYLE.md`](./API_STYLE.md) | Perbandingan REST+OpenAPI vs tRPC vs Hybrid, dengan rekomendasi & detail implementasi |
| [`ERD.md`](./ERD.md) | Entity relationship diagram (Mermaid), sequence diagram posting/import/RLS, state machine period & import, penjelasan keputusan desain |
| [`MIGRATION_FROM_V1.md`](./MIGRATION_FROM_V1.md) | Strategi & langkah ETL v1 (MySQL) → v2 (PostgreSQL), mapping tabel, reconciliation queries, timeline cutover |

## Daftar artefak SQL & seed

| File | Isi |
|---|---|
| [`../migrations/0001_extensions.sql`](../migrations/0001_extensions.sql) | Extensions: citext, ltree, pgcrypto, pg_stat_statements |
| [`../migrations/0002_roles.sql`](../migrations/0002_roles.sql) | Roles: app_owner, app_user, app_admin + default privileges |
| [`../migrations/0003_core_tables.sql`](../migrations/0003_core_tables.sql) | Tabel: firms, users, companies, company_members |
| [`../migrations/0004_accounts_periods.sql`](../migrations/0004_accounts_periods.sql) | Tabel: accounts (COA, ltree), accounting_periods |
| [`../migrations/0005_ledger.sql`](../migrations/0005_ledger.sql) | Tabel: journal_entries, journal_lines |
| [`../migrations/0006_ledger_constraints.sql`](../migrations/0006_ledger_constraints.sql) | Trigger: balanced (deferred), period-open, immutability, postable account |
| [`../migrations/0007_reporting.sql`](../migrations/0007_reporting.sql) | Tabel + function: posting_number_counters, account_period_balance, refresh function |
| [`../migrations/0008_import_audit.sql`](../migrations/0008_import_audit.sql) | Tabel: import_batches, audit_log + hash chain trigger + verify_audit_chain |
| [`../migrations/0009_rls.sql`](../migrations/0009_rls.sql) | Row-Level Security policies (multi-tenant isolation) |
| [`../migrations/0010_indexes.sql`](../migrations/0010_indexes.sql) | Composite indexes untuk laporan, trigram untuk full-text |
| [`../seeds/coa_default_indonesia.sql`](../seeds/coa_default_indonesia.sql) | Function `seed_default_coa()` + `bootstrap_accounting_periods()` |

## Cara menjalankan migrations (manual, untuk uji)

Asumsi: PostgreSQL 16 sudah jalan, ada user `postgres`.

```bash
# 1. Create database
createdb eccounting_v2_dev

# 2. Jalan dari urut nomor (sebagai superuser dulu untuk roles)
psql -d eccounting_v2_dev -f migrations/0001_extensions.sql
psql -d eccounting_v2_dev -f migrations/0002_roles.sql
psql -d eccounting_v2_dev -U app_owner -f migrations/0003_core_tables.sql
psql -d eccounting_v2_dev -U app_owner -f migrations/0004_accounts_periods.sql
psql -d eccounting_v2_dev -U app_owner -f migrations/0005_ledger.sql
psql -d eccounting_v2_dev -U app_owner -f migrations/0006_ledger_constraints.sql
psql -d eccounting_v2_dev -U app_owner -f migrations/0007_reporting.sql
psql -d eccounting_v2_dev -U app_owner -f migrations/0008_import_audit.sql
psql -d eccounting_v2_dev -U app_owner -f migrations/0009_rls.sql
psql -d eccounting_v2_dev -U app_owner -f migrations/0010_indexes.sql

# 3. Load seed function
psql -d eccounting_v2_dev -U app_owner -f seeds/coa_default_indonesia.sql

# 4. Smoke test: create firm, company, seed COA
psql -d eccounting_v2_dev -U app_owner <<SQL
INSERT INTO firms (name) VALUES ('Kantor Konsultan Demo') RETURNING id;
INSERT INTO companies (firm_id, name) VALUES (1, 'PT Demo Klien') RETURNING id;
SELECT seed_default_coa(1);
SELECT bootstrap_accounting_periods(1, 2026::SMALLINT);
SET LOCAL app.company_id = '1';
SELECT count(*) FROM accounts;     -- harus ~150
SELECT count(*) FROM accounting_periods;  -- harus 12
SQL
```

Kalau pakai migration tool (recommended untuk production):

- **golang-migrate**: rename file ke `0001_extensions.up.sql` & buat `.down.sql` pairs
- **node-pg-migrate**: convert ke `.js` wrapper atau pakai `--migrations-table`
- **Drizzle Kit**: pakai sebagai raw SQL migration via `drizzle.config.ts` → `out: './migrations'`
- **Atlas**: support raw SQL natif
- **Laravel Artisan** (jika hybrid v1): wrap di `DB::unprepared(file_get_contents('migrations/0001_extensions.sql'))`

## Konvensi penamaan

- Tabel: `snake_case`, plural (`journal_entries`, bukan `journal_entry`)
- Kolom: `snake_case`
- Constraint: `<table>_<col>_<type>` (mis. `accounts_company_id_fkey`)
- Index: `<table>_<col>_<purpose>_idx` (mis. `je_company_posting_date_idx`)
- Trigger: `trg_<purpose>` untuk function, `<table>_<event>` untuk trigger name
- Error code di RAISE EXCEPTION: SCREAMING_SNAKE (mis. `JOURNAL_UNBALANCED`) — di-parse aplikasi untuk return business error

## Next step

Setelah review dokumen-dokumen ini, langkah berikutnya:

1. **Konfirmasi gaya API** (REST + OpenAPI vs tRPC vs hybrid) — lihat `API_STYLE.md`.
2. **Scaffold monorepo** (Turborepo + pnpm + NestJS + Next.js + Drizzle + Docker Compose) — saya bisa generate ini kalau sudah confirm.
3. **Implementasi modul pertama**: `auth` + `companies` + `accounts` + `periods` sebagai foundation, lalu `journal` sebagai inti.
4. **ETL service v1 → v2** paralel dengan development v2.
