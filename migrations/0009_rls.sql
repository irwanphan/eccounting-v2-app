-- =============================================================================
-- 0009_rls.sql
-- Row-Level Security: enforce multi-company isolation di level database.
--
-- Cara pakai dari aplikasi (NestJS):
--   1. Saat handle request, set tenant context:
--        SET LOCAL app.company_id = '42';
--      (LOCAL = transaction-scoped, otomatis cleared di rollback/commit)
--   2. Semua query setelah itu auto-filter dengan company_id = 42.
--   3. Kalau company_id tidak di-set, hampir semua tabel return 0 rows
--      (kecuali tabel di mana superuser policy diberikan untuk operasional).
--
-- Catatan: app_user/app_admin TIDAK BYPASSRLS. Hanya superuser & app_owner bypass.
-- =============================================================================

SET search_path TO eccounting, public;

-- -----------------------------------------------------------------------------
-- Helper function: ambil current tenant. Return NULL kalau tidak di-set.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_company_id() RETURNS BIGINT
    LANGUAGE plpgsql
    STABLE
AS $$
DECLARE
    v_val TEXT;
BEGIN
    BEGIN
        v_val := current_setting('app.company_id', true);
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
    END;
    IF v_val IS NULL OR v_val = '' THEN
        RETURN NULL;
    END IF;
    RETURN v_val::BIGINT;
END $$;

-- -----------------------------------------------------------------------------
-- ACCOUNTS
-- -----------------------------------------------------------------------------
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounts_tenant_isolation ON accounts;
CREATE POLICY accounts_tenant_isolation ON accounts
    USING      (company_id = current_company_id())
    WITH CHECK (company_id = current_company_id());

-- -----------------------------------------------------------------------------
-- ACCOUNTING_PERIODS
-- -----------------------------------------------------------------------------
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounting_periods_tenant_isolation ON accounting_periods;
CREATE POLICY accounting_periods_tenant_isolation ON accounting_periods
    USING      (company_id = current_company_id())
    WITH CHECK (company_id = current_company_id());

-- -----------------------------------------------------------------------------
-- JOURNAL_ENTRIES
-- -----------------------------------------------------------------------------
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS je_tenant_isolation ON journal_entries;
CREATE POLICY je_tenant_isolation ON journal_entries
    USING      (company_id = current_company_id())
    WITH CHECK (company_id = current_company_id());

-- -----------------------------------------------------------------------------
-- JOURNAL_LINES
-- (company_id sudah didenormalisasi, RLS jadi cepat)
-- -----------------------------------------------------------------------------
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS jl_tenant_isolation ON journal_lines;
CREATE POLICY jl_tenant_isolation ON journal_lines
    USING      (company_id = current_company_id())
    WITH CHECK (company_id = current_company_id());

-- -----------------------------------------------------------------------------
-- POSTING_NUMBER_COUNTERS
-- -----------------------------------------------------------------------------
ALTER TABLE posting_number_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE posting_number_counters FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pnc_tenant_isolation ON posting_number_counters;
CREATE POLICY pnc_tenant_isolation ON posting_number_counters
    USING      (company_id = current_company_id())
    WITH CHECK (company_id = current_company_id());

-- -----------------------------------------------------------------------------
-- ACCOUNT_PERIOD_BALANCE
-- -----------------------------------------------------------------------------
ALTER TABLE account_period_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_period_balance FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS apb_tenant_isolation ON account_period_balance;
CREATE POLICY apb_tenant_isolation ON account_period_balance
    USING      (company_id = current_company_id())
    WITH CHECK (company_id = current_company_id());

-- -----------------------------------------------------------------------------
-- IMPORT_BATCHES
-- -----------------------------------------------------------------------------
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ib_tenant_isolation ON import_batches;
CREATE POLICY ib_tenant_isolation ON import_batches
    USING      (company_id = current_company_id())
    WITH CHECK (company_id = current_company_id());

-- -----------------------------------------------------------------------------
-- COMPANIES (special: user hanya boleh lihat company tempat dia member)
-- Untuk simplenes: skip RLS di companies, isolation di app level dengan
-- INNER JOIN company_members. Aktifkan jika ingin paranoid mode.
-- -----------------------------------------------------------------------------
-- (Opsional, tidak diaktifkan default karena admin/owner butuh akses lintas company)

-- -----------------------------------------------------------------------------
-- AUDIT_LOG (tidak pakai company-RLS karena ada baris cross-company,
--           tapi tabel ini sudah immutable + protected via app layer)
-- -----------------------------------------------------------------------------
-- Tidak enable RLS. Aplikasi yang filter berdasarkan firm/company membership.

-- =============================================================================
-- TESTING: cara verifikasi
-- =============================================================================
-- Sebagai app_user:
--   SET LOCAL app.company_id = '1';
--   SELECT count(*) FROM journal_entries;  -- hanya company 1
--
-- Tanpa set:
--   RESET app.company_id;
--   SELECT count(*) FROM journal_entries;  -- 0 rows
--
-- Coba bypass (akan ditolak):
--   SET LOCAL app.company_id = '1';
--   SELECT * FROM journal_entries WHERE company_id = 2;  -- still 0 rows (USING clause)
--   INSERT INTO journal_entries (company_id, ...) VALUES (2, ...);  -- ERROR (WITH CHECK)
