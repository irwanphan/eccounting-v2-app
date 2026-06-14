#!/usr/bin/env bash
# One-shot dev bootstrap: docker → migrate → seed → ready.
#
# Usage: ./scripts/dev-up.sh

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." &> /dev/null && pwd)"

cd "${REPO_ROOT}"

if [[ ! -f ".env" ]]; then
  echo "[dev-up] .env tidak ada, copy dari .env.example..."
  cp .env.example .env
  echo "[dev-up] PENTING: edit .env dulu, terutama POSTGRES_*_PASSWORD & JWT_SECRET"
fi

echo "[dev-up] starting docker services..."
docker compose up -d

echo "[dev-up] menunggu PostgreSQL siap..."
until docker compose exec -T postgres pg_isready -U "${POSTGRES_SUPERUSER:-postgres}" > /dev/null 2>&1; do
  printf '.'
  sleep 1
done
echo

echo "[dev-up] running migrations..."
pnpm db:migrate

echo "[dev-up] loading seed function definitions..."
pnpm db:seed

echo
echo "[dev-up] ✓ ready"
echo "Selanjutnya:"
echo "  - Setup roles password   : ./scripts/setup-roles.sh"
echo "  - Bootstrap demo data    : pnpm db:seed -- --bootstrap-demo"
echo "  - Jalankan semua app     : pnpm dev"
echo "  - PostgreSQL             : psql \"\${DATABASE_URL}\""
echo "  - MinIO console          : http://localhost:9001 (minioadmin/minioadmin)"
echo "  - MailHog UI             : http://localhost:8025"
