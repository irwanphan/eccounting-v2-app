#!/usr/bin/env bash
# Stop dev infrastructure (preserve volumes).
#
# Usage:
#   ./scripts/dev-down.sh             # stop, keep volumes
#   ./scripts/dev-down.sh --wipe      # stop & delete volumes (data hilang)

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." &> /dev/null && pwd)"

cd "${REPO_ROOT}"

if [[ "${1:-}" == "--wipe" ]]; then
  read -r -p "Ini akan HAPUS data PostgreSQL + Redis + MinIO. Lanjut? [ketik WIPE]: " ans
  if [[ "${ans}" == "WIPE" ]]; then
    docker compose down -v
    echo "[dev-down] ✓ stopped & volumes wiped"
  else
    echo "cancelled"
  fi
else
  docker compose down
  echo "[dev-down] ✓ stopped (volumes preserved)"
fi
