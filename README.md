# Eccounting v2

> Multi-company accounting platform untuk kantor konsultan pajak.
> Rebuild dari Eccounting v1 (Laravel 5.5 / PHP 7.0 / MySQL 5.7) — TS end-to-end stack.

## Tech stack

| Layer | Tech |
|---|---|
| Database | **PostgreSQL 16** (RLS, DEFERRABLE constraints, ltree, pgcrypto) |
| Queue / cache | Redis 7 + BullMQ |
| File storage | S3-compatible (MinIO untuk dev, R2/S3 untuk prod) |
| Backend | **NestJS** + Drizzle ORM + Fastify |
| Frontend | **Next.js 15** (App Router) + React 19 + Tailwind + shadcn/ui |
| API style | REST + OpenAPI codegen |
| Monorepo | Turborepo + pnpm workspaces |

Detail rationale: lihat [`docs/`](./docs/).

## Struktur

```
eccounting-v2-app/
├── apps/
│   ├── api/                  # NestJS REST API (belum dibuat)
│   ├── web/                  # Next.js dashboard (belum dibuat)
│   └── worker/               # NestJS queue worker (belum dibuat)
├── packages/
│   ├── config/               # Shared tsconfig, eslint, prettier
│   ├── db/                   # Drizzle schema + migration runner
│   └── shared/               # Zod schemas + DTO (belum dibuat)
├── migrations/               # Raw SQL migrations (10 files, source of truth)
├── seeds/                    # COA default Indonesia
├── docs/                     # Design docs, ERD, rationale, migration plan
├── docker-compose.yml        # PostgreSQL 16 + Redis 7 + MinIO + MailHog
├── .env.example
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## Quickstart (dev)

### Prasyarat

- Node.js ≥ 20.11 (lihat `.nvmrc`)
- pnpm ≥ 9
- Docker + Docker Compose
- (opsional) `psql` CLI untuk query manual

### 1. Install dependencies

```bash
pnpm install
```

### 2. Setup environment

```bash
cp .env.example .env
# edit .env sesuai kebutuhan (terutama JWT_SECRET di production)
```

### 3. Jalankan infrastructure (PostgreSQL + Redis + MinIO + MailHog)

```bash
docker compose up -d
```

Verifikasi:
- PostgreSQL: `psql postgres://postgres:postgres@localhost:5432/eccounting_v2 -c '\dx'`
- MinIO console: <http://localhost:9001> (login `minioadmin` / `minioadmin`)
- MailHog UI: <http://localhost:8025>

### 4. Jalankan migrations (raw SQL)

```bash
pnpm db:migrate
```

Atau manual:

```bash
for f in migrations/*.sql; do
  echo "-- $f"
  docker exec -i eccounting-v2-postgres \
    psql -U postgres -d eccounting_v2 -v ON_ERROR_STOP=1 < "$f"
done
```

### 5. Seed COA + bootstrap test data

```bash
pnpm db:seed
```

### 6. Jalankan semua app (parallel)

```bash
pnpm dev
```

- API: <http://localhost:3001/v1>
- Swagger: <http://localhost:3001/docs>
- Web: <http://localhost:3000>

## Dokumentasi penting

| Topic | File |
|---|---|
| Audit v1 + prinsip akuntansi | [`docs/AUDIT_REKOMENDASI_V2.md`](./docs/AUDIT_REKOMENDASI_V2.md) |
| ERD + sequence diagrams | [`docs/ERD.md`](./docs/ERD.md) |
| Kenapa NestJS | [`docs/NESTJS_RATIONALE.md`](./docs/NESTJS_RATIONALE.md) |
| Kenapa PostgreSQL | [`docs/POSTGRESQL_RATIONALE.md`](./docs/POSTGRESQL_RATIONALE.md) |
| API style (REST + OpenAPI) | [`docs/API_STYLE.md`](./docs/API_STYLE.md) |
| Migrasi data v1 → v2 | [`docs/MIGRATION_FROM_V1.md`](./docs/MIGRATION_FROM_V1.md) |
| Indeks lengkap docs | [`docs/README.md`](./docs/README.md) |

## Roadmap scaffold

- [x] Monorepo root (package.json, turbo.json, pnpm-workspace.yaml, tsconfig.base)
- [x] Tooling configs (`packages/config`: tsconfig presets, eslint, prettier)
- [x] Docker compose dev environment (PG + Redis + MinIO + MailHog)
- [x] SQL migrations + seed COA Indonesia
- [x] `packages/db` (Drizzle schema + tenant context helper) — partial
- [ ] `packages/db` — complete schema mirror + migration runner script
- [ ] `packages/shared` (Zod DTO + business types)
- [ ] `apps/api` (NestJS skeleton)
- [ ] `apps/web` (Next.js skeleton)
- [ ] `apps/worker` (NestJS worker)
- [ ] OpenAPI codegen pipeline

## Lisensi

Internal / proprietary.
