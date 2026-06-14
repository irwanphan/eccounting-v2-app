# Eccounting v2

> Multi-company accounting platform untuk kantor konsultan pajak.
> Rebuild dari Eccounting v1 (Laravel 5.5 / PHP 7.0 / MySQL 5.7) ke TS end-to-end.

## Tech stack

| Layer | Tech |
|---|---|
| Database | **PostgreSQL 16** (RLS, DEFERRABLE constraints, ltree, pgcrypto) |
| Queue / cache | Redis 7 + BullMQ |
| File storage | S3-compatible (MinIO dev, R2/S3 prod) |
| Backend | **NestJS 10 + Fastify** + Drizzle ORM |
| Frontend | **Next.js 15** (App Router) + React 19 + Tailwind |
| API style | REST + OpenAPI codegen |
| Monorepo | Turborepo + pnpm workspaces |

Detail rationale: lihat [`docs/`](./docs/).

---

## Struktur

```
eccounting-v2-app/
├── apps/
│   ├── api/                  NestJS REST API (Fastify, JWT, Swagger)
│   ├── web/                  Next.js 15 dashboard
│   └── worker/               NestJS BullMQ worker + scheduler
├── packages/
│   ├── config/               Shared tsconfig + eslint + prettier
│   ├── db/                   Drizzle schema + migration/seed runner
│   └── shared/               Zod schemas + error codes + DTO types
├── migrations/               Raw SQL migrations (10 file, source of truth)
├── seeds/                    COA Indonesia function + bootstrap helper
├── scripts/                  dev-up/down, setup-roles, codegen-openapi
├── docs/                     Design docs, ERD, rationale, migration plan
├── docker-compose.yml        PostgreSQL 16 + Redis 7 + MinIO + MailHog
├── .env.example
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

---

## Quickstart (dev)

### Prasyarat

- Node.js ≥ 20.11 (lihat `.nvmrc`)
- pnpm ≥ 9 (`npm i -g pnpm@9`)
- Docker + Docker Compose

### 1. Install dependencies

```bash
pnpm install
```

### 2. Setup environment

```bash
cp .env.example .env
# edit .env, terutama:
#   - POSTGRES_*_PASSWORD (3 role: owner, user, admin)
#   - JWT_SECRET (random ≥ 64 char untuk production)
```

> ⚠️ **Jangan commit `.env`** — sudah masuk `.gitignore`. Kalau password mengandung karakter spesial seperti `@`, `:`, `/`, `#`, **harus di-URL-encode** di `DATABASE_URL` (mis. `@` → `%40`).

### 3. Bootstrap full (paling mudah)

```bash
./scripts/dev-up.sh
```

Script ini akan:
1. Copy `.env.example` → `.env` kalau belum ada
2. `docker compose up -d` (PostgreSQL + Redis + MinIO + MailHog)
3. Tunggu PostgreSQL siap
4. Run `pnpm db:migrate`
5. Load function di `seeds/`

### 4. (Opsional) Bootstrap demo data + setup role passwords

```bash
# bikin firm/user/company demo + seed COA + accounting periods
pnpm db:seed -- --bootstrap-demo

# set password untuk role app_user/app_admin/app_owner dari .env
./scripts/setup-roles.sh
```

### 5. Jalankan semua app

```bash
pnpm dev
```

Lalu buka:

| URL | Service |
|---|---|
| <http://localhost:3000> | Web (Next.js) |
| <http://localhost:3000/login> | Login form (belum connected ke auth backend) |
| <http://localhost:3001/v1/health> | API liveness |
| <http://localhost:3001/v1/health/ready> | API readiness (cek DB) |
| <http://localhost:3001/docs> | Swagger UI |
| <http://localhost:9001> | MinIO console (minioadmin/minioadmin) |
| <http://localhost:8025> | MailHog UI |

### 6. (Setelah API jalan) Generate TypeScript client untuk web

```bash
pnpm openapi:codegen
# atau: ./scripts/codegen-openapi.sh
```

Hasil → `apps/web/src/generated/api-types.ts`.

---

## Workflow umum

| Tugas | Perintah |
|---|---|
| Install deps baru di workspace | `pnpm --filter @eccounting/api add <pkg>` |
| Run migration baru saja | `pnpm db:migrate` |
| Dry-run migration | `pnpm db:migrate -- --dry-run` |
| Reset DB (dev only!) | `pnpm db:reset -- --yes --then-migrate` |
| Drizzle Studio (GUI) | `pnpm --filter @eccounting/db studio` |
| Build semua | `pnpm build` |
| Lint semua | `pnpm lint` |
| Typecheck semua | `pnpm typecheck` |
| Format code | `pnpm format` |
| Stop infra (preserve data) | `./scripts/dev-down.sh` |
| Stop infra + wipe data | `./scripts/dev-down.sh --wipe` |

---

## Status implementasi

| Komponen | Status | Catatan |
|---|---|---|
| Docs (audit, rationale, ERD, migration plan) | ✅ | Lihat `docs/` |
| SQL migrations (10 file) | ✅ | Source of truth |
| Seed COA Indonesia | ✅ | Function `seed_default_coa(company_id)` |
| `packages/config` (tsconfig + eslint + prettier) | ✅ | |
| `packages/db` (Drizzle schema + scripts) | ✅ | Schema mirror dari migrations |
| `packages/shared` (Zod + errors + types) | ✅ | |
| `apps/api` (NestJS skeleton) | 🟡 skeleton | DB infra + Queue + Health endpoint. Modul auth/companies/journal **belum**. |
| `apps/web` (Next.js skeleton) | 🟡 skeleton | Landing + Login form + Dashboard placeholder. Auth wiring **belum**. |
| `apps/worker` (NestJS worker) | 🟡 skeleton | 3 processor stub + balance-snapshot scheduler. Excel parsing **belum**. |
| OpenAPI codegen pipeline | ✅ script | Jalankan setelah API running |

---

## Dokumentasi penting

| Topic | File |
|---|---|
| Audit v1 + prinsip akuntansi v2 | [`docs/AUDIT_REKOMENDASI_V2.md`](./docs/AUDIT_REKOMENDASI_V2.md) |
| ERD + sequence diagrams | [`docs/ERD.md`](./docs/ERD.md) |
| Kenapa NestJS | [`docs/NESTJS_RATIONALE.md`](./docs/NESTJS_RATIONALE.md) |
| Kenapa PostgreSQL | [`docs/POSTGRESQL_RATIONALE.md`](./docs/POSTGRESQL_RATIONALE.md) |
| API style (REST + OpenAPI) | [`docs/API_STYLE.md`](./docs/API_STYLE.md) |
| Migrasi data v1 → v2 | [`docs/MIGRATION_FROM_V1.md`](./docs/MIGRATION_FROM_V1.md) |
| Indeks lengkap dokumen | [`docs/README.md`](./docs/README.md) |

---

## Next steps (development roadmap)

Per modul yang masih harus diimplementasi:

1. **Auth module** (`apps/api/src/modules/auth/`)
   - JWT issue/refresh, password hashing (argon2id), JwtAuthGuard
   - Endpoint `/v1/auth/login`, `/v1/auth/refresh`, `/v1/auth/me`
2. **Companies module**
   - CRUD + member management
   - Saat create: panggil `seed_default_coa()` + `bootstrap_accounting_periods()`
   - CompanyMemberGuard untuk enforce membership
3. **Accounts module** (CRUD COA, query subtree via ltree)
4. **Periods module** (open/close/lock state machine)
5. **Journal module** (intinya — `JournalService.postEntry` atomic dengan tenant context)
6. **Reports module** (neraca, laba rugi, buku besar, neraca saldo)
7. **Import module** (upload Excel → enqueue → worker process)
8. **Web app**:
   - Auth context + cookie-based session
   - Company picker
   - Tabel jurnal (TanStack Table virtualized)
   - Form posting jurnal dynamic
   - Halaman laporan

---

## Lisensi

Internal / proprietary.
