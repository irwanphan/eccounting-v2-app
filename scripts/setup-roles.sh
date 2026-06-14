#!/usr/bin/env bash
# Setup PostgreSQL roles dengan password dari .env.
# Jalan SEKALI setelah pertama kali docker compose up + migrations applied.
#
# Usage:
#   ./scripts/setup-roles.sh                  # interactive
#   ./scripts/setup-roles.sh --force          # skip confirm

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." &> /dev/null && pwd)"

if [[ -f "${REPO_ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${REPO_ROOT}/.env"
  set +a
fi

: "${POSTGRES_SUPERUSER:=postgres}"
: "${POSTGRES_SUPERUSER_PASSWORD:=postgres}"
: "${POSTGRES_HOST:=localhost}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_DB:=eccounting_v2}"
: "${APP_USER_PASSWORD:?env APP_USER_PASSWORD wajib di-set di .env}"
: "${APP_ADMIN_PASSWORD:?env APP_ADMIN_PASSWORD wajib di-set di .env}"
: "${APP_OWNER_PASSWORD:?env APP_OWNER_PASSWORD wajib di-set di .env}"

FORCE="${1:-}"
if [[ "${FORCE}" != "--force" ]]; then
  echo "Akan set/update password untuk role: app_owner, app_user, app_admin"
  echo "Database: postgres://${POSTGRES_SUPERUSER}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
  read -r -p "Lanjut? [y/N] " ans
  [[ "${ans}" == "y" || "${ans}" == "Y" ]] || { echo "cancelled"; exit 0; }
fi

export PGPASSWORD="${POSTGRES_SUPERUSER_PASSWORD}"

psql \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_SUPERUSER}" \
  -d "${POSTGRES_DB}" \
  -v ON_ERROR_STOP=1 \
  -v owner_pwd="${APP_OWNER_PASSWORD}" \
  -v user_pwd="${APP_USER_PASSWORD}" \
  -v admin_pwd="${APP_ADMIN_PASSWORD}" \
  <<'SQL'
ALTER ROLE app_owner WITH LOGIN PASSWORD :'owner_pwd';
ALTER ROLE app_user  WITH LOGIN PASSWORD :'user_pwd';
ALTER ROLE app_admin WITH LOGIN PASSWORD :'admin_pwd';
SELECT 'roles updated' AS status;
SQL

echo "✓ Roles updated. Pastikan DATABASE_URL di .env memakai role app_user untuk runtime."
