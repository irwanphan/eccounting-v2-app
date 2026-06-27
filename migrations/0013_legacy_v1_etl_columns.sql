-- Legacy mapping columns untuk ETL v1 → v2 (reconciliation & idempotent re-run)
SET search_path TO eccounting, public;

ALTER TABLE eccounting.accounts
  ADD COLUMN IF NOT EXISTS legacy_v1_coa_id BIGINT;

COMMENT ON COLUMN eccounting.accounts.legacy_v1_coa_id IS
  'ID dari tabel v1 coa — dipakai saat ETL untuk traceability & upsert';

CREATE UNIQUE INDEX IF NOT EXISTS accounts_company_legacy_v1_coa_id_idx
  ON eccounting.accounts (company_id, legacy_v1_coa_id)
  WHERE legacy_v1_coa_id IS NOT NULL;

ALTER TABLE eccounting.journal_entries
  ADD COLUMN IF NOT EXISTS legacy_v1_group_journal_id BIGINT;

COMMENT ON COLUMN eccounting.journal_entries.legacy_v1_group_journal_id IS
  'ID dari tabel v1 group_journal — dipakai saat ETL untuk traceability & skip re-import';

CREATE UNIQUE INDEX IF NOT EXISTS je_company_legacy_v1_group_journal_id_idx
  ON eccounting.journal_entries (company_id, legacy_v1_group_journal_id)
  WHERE legacy_v1_group_journal_id IS NOT NULL;
