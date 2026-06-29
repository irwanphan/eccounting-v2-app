# Dokumentasi Eccounting v2

Folder ini berisi dokumentasi desain & strategi untuk rebuild Eccounting v2.

## Daftar dokumen

| Dokumen | Isi |
|---|---|
| [`AUDIT_REKOMENDASI_V2.md`](./AUDIT_REKOMENDASI_V2.md) | Audit codebase v1 (19 bug + severity), prinsip wajib aplikasi akuntansi, rekomendasi stack awal, rencana migrasi 6 fase, quick wins v1 |
| [`NESTJS_RATIONALE.md`](./NESTJS_RATIONALE.md) | Alasan teknis & bisnis pakai NestJS (vs Next.js as backend), 12 alasan konkret, struktur folder usulan |
| [`API_STYLE.md`](./API_STYLE.md) | Perbandingan REST+OpenAPI vs tRPC vs Hybrid, dengan rekomendasi & detail implementasi |
| [`POSTGRESQL_RATIONALE.md`](./POSTGRESQL_RATIONALE.md) | Perbandingan PostgreSQL vs MySQL untuk aplikasi akuntansi (RLS, DEFERRABLE constraints, ekstensi) |
| [`ERD.md`](./ERD.md) | Entity relationship diagram (Mermaid), sequence diagram posting/import/RLS, state machine period & import, penjelasan keputusan desain |
| [`MIGRATION_FROM_V1.md`](./MIGRATION_FROM_V1.md) | Strategi & langkah ETL v1 (MySQL) → v2 (PostgreSQL), mapping tabel, reconciliation queries, timeline cutover |
| [`JOURNAL_REVERSAL.md`](./JOURNAL_REVERSAL.md) | Pembatalan jurnal v2 (reversal vs v1 hard delete), API, UI, aturan bisnis, testing manual |

## Infra development (`docker-compose.yml`)

`docker compose` di repo ini **khusus untuk development lokal** (`name: eccounting-v2-dev`). Semua service infra berjalan di **container**; aplikasi (API, web, worker) dijalankan di host via `pnpm dev`.

| Container | Image | Port default | Fungsi |
|---|---|---|---|
| `eccounting-v2-postgres` | `postgres:16-alpine` | 5432 | Database utama |
| `eccounting-v2-redis` | `redis:7-alpine` | 6379 | Queue BullMQ + cache |
| `eccounting-v2-minio` | `minio/minio` | 9000 (API), 9001 (console) | Pengganti S3 untuk file import Excel (dev) |
| `eccounting-v2-minio-init` | `minio/mc` | — | One-shot: buat bucket `eccounting-imports` |
| `eccounting-v2-mailhog` | `mailhog/mailhog` | 1025 (SMTP), 8025 (UI) | Pengganti SMTP untuk tes email |

Data container persist di named volumes: `postgres_data`, `redis_data`, `minio_data`.

> **Production:** Redis dan object storage tidak wajib di-container — bisa pakai managed service (Upstash, Cloudflare R2, dll.). Detail opsi deploy akan ditambahkan di `DEPLOYMENT.md`.

Retensi file import Excel: lihat [`ERD.md` §5.1](./ERD.md) — metadata permanen di `import_batches`, object file sementara di MinIO/S3.

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

## Cara menjalankan migrations (recommended: pakai runner)

Project ini sudah ship runner Node.js di `packages/db/scripts/`. Dari repo root:

```bash
# install deps
pnpm install

# spin up infra
./scripts/dev-up.sh                  # docker + migrate + load seed function

# atau manual step-by-step:
docker compose up -d
pnpm db:migrate                      # apply semua migrations (idempotent)
pnpm db:migrate -- --dry-run         # preview saja
pnpm db:migrate -- --to 0005         # apply sampai versi tertentu
pnpm db:seed                         # load function seed (tidak insert data)
pnpm db:seed -- --bootstrap-demo     # + bikin firm/user/company demo
pnpm db:reset -- --yes               # DROP SCHEMA + recreate (DEV ONLY)
```

Runner ada di `packages/db/scripts/run-migrations.ts` (idempotent via checksum di tabel `eccounting._migrations`) dan `packages/db/scripts/run-seeds.ts`.

### Manual (kalau mau jalan tanpa runner)

```bash
createdb eccounting_v2_dev
for f in migrations/*.sql; do
  psql -d eccounting_v2_dev -v ON_ERROR_STOP=1 -f "$f"
done
psql -d eccounting_v2_dev -f seeds/coa_default_indonesia.sql
```

## Konvensi penamaan

- Tabel: `snake_case`, plural (`journal_entries`, bukan `journal_entry`)
- Kolom: `snake_case`
- Constraint: `<table>_<col>_<type>` (mis. `accounts_company_id_fkey`)
- Index: `<table>_<col>_<purpose>_idx` (mis. `je_company_posting_date_idx`)
- Trigger: `trg_<purpose>` untuk function, `<table>_<event>` untuk trigger name
- Error code di RAISE EXCEPTION: SCREAMING_SNAKE (mis. `JOURNAL_UNBALANCED`) — di-parse aplikasi untuk return business error

## Next step (implementasi)

Foundation sudah scaffolded (lihat [`../README.md`](../README.md) §Status implementasi).
Roadmap modul berikutnya:

1. **Auth module** (`apps/api/src/modules/auth/`)
   - argon2id password hashing
   - JWT issue + refresh + revoke
   - `JwtAuthGuard` & `CurrentUser` decorator
2. **Companies module** + `CompanyMemberGuard`
   - Saat create company: panggil `seed_default_coa()` + `bootstrap_accounting_periods()` dalam 1 transaction
3. **Accounts module** (CRUD + query subtree via `ltree` op `<@`)
4. **Periods module** (state machine: open → closed → locked)
5. **Journal module** (inti) — `JournalService.postEntry` atomic dengan tenant context (RLS)
6. **Reports module** (neraca, laba rugi, buku besar, neraca saldo) — baca dari `account_period_balance`
7. **Import module** (upload Excel → `import_batches` insert → enqueue → worker process)
8. **ETL v1 → v2** paralel — lihat [`MIGRATION_FROM_V1.md`](./MIGRATION_FROM_V1.md)
