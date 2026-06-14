#!/usr/bin/env bash
# Generate TypeScript types dari OpenAPI spec yang di-expose apps/api.
# Membutuhkan apps/api running (default: http://localhost:3001/docs-json).
#
# Usage: ./scripts/codegen-openapi.sh

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." &> /dev/null && pwd)"

cd "${REPO_ROOT}"

API_URL="${API_URL:-http://localhost:3001}"
SPEC_URL="${API_URL}/docs-json"
OUTPUT="apps/web/src/generated/api-types.ts"

echo "[codegen] checking API readiness at ${SPEC_URL}..."
if ! curl -fsS "${SPEC_URL}" -o /dev/null; then
  echo "[codegen] ERROR: API tidak running atau tidak expose OpenAPI."
  echo "         Jalankan dulu: pnpm --filter @eccounting/api dev"
  exit 1
fi

mkdir -p "$(dirname "${OUTPUT}")"
pnpm exec openapi-typescript "${SPEC_URL}" -o "${OUTPUT}"

echo "[codegen] ✓ generated → ${OUTPUT}"
echo "         re-run setelah modifikasi controller/DTO di apps/api"
