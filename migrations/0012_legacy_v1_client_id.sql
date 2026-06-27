-- Legacy mapping v1 client.id → v2 companies (untuk reconciliation ETL)
ALTER TABLE eccounting.companies
  ADD COLUMN IF NOT EXISTS legacy_v1_client_id BIGINT;

COMMENT ON COLUMN eccounting.companies.legacy_v1_client_id IS
  'ID dari tabel v1 client — dipakai saat bootstrap & ETL untuk traceability';

CREATE UNIQUE INDEX IF NOT EXISTS companies_firm_legacy_v1_client_id_idx
  ON eccounting.companies (firm_id, legacy_v1_client_id)
  WHERE legacy_v1_client_id IS NOT NULL;
