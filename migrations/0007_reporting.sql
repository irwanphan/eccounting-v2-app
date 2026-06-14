-- =============================================================================
-- 0007_reporting.sql
-- Reporting infrastructure:
--   1. posting_number_counters  — atomic posting number generator per company per bulan
--   2. account_period_balance   — snapshot saldo per akun per bulan (untuk laporan cepat)
--   3. helper functions         — next_posting_number, refresh_account_period_balance
-- =============================================================================

SET search_path TO eccounting, public;

-- -----------------------------------------------------------------------------
-- 1. POSTING_NUMBER_COUNTERS
-- Counter per (company, YYYYMM). Increment dengan UPDATE ... RETURNING.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posting_number_counters (
    company_id   BIGINT  NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    yyyymm       CHAR(6) NOT NULL,
    prefix       TEXT    NOT NULL DEFAULT 'JU',
    last_value   INT     NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (company_id, yyyymm)
);

COMMENT ON TABLE posting_number_counters IS
    'Counter atomic untuk generate posting_number. Gunakan UPSERT + RETURNING.';

-- Helper: ambil posting number berikutnya untuk company+date.
-- Atomic via INSERT ON CONFLICT DO UPDATE RETURNING.
CREATE OR REPLACE FUNCTION next_posting_number(p_company_id BIGINT, p_date DATE)
    RETURNS TEXT
    LANGUAGE plpgsql
AS $$
DECLARE
    v_yyyymm  CHAR(6);
    v_prefix  TEXT;
    v_value   INT;
BEGIN
    v_yyyymm := to_char(p_date, 'YYYYMM');

    -- Ambil prefix dari companies
    SELECT posting_number_prefix INTO v_prefix
      FROM companies WHERE id = p_company_id;

    IF v_prefix IS NULL THEN
        RAISE EXCEPTION 'COMPANY_NOT_FOUND: company % not found', p_company_id;
    END IF;

    -- Upsert + increment atomic
    INSERT INTO posting_number_counters (company_id, yyyymm, prefix, last_value)
         VALUES (p_company_id, v_yyyymm, v_prefix, 1)
    ON CONFLICT (company_id, yyyymm)
    DO UPDATE SET last_value = posting_number_counters.last_value + 1,
                  updated_at = now()
    RETURNING last_value INTO v_value;

    RETURN v_prefix || v_yyyymm || lpad(v_value::text, 5, '0');
END $$;

COMMENT ON FUNCTION next_posting_number IS
    'Atomic posting number generator. Format: <PREFIX><YYYYMM><00001>';

-- -----------------------------------------------------------------------------
-- 2. ACCOUNT_PERIOD_BALANCE
-- Snapshot saldo: opening + debit_total + credit_total + closing per akun per bulan.
-- Refresh secara incremental (per posting) atau full (cron).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_period_balance (
    company_id    BIGINT         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    account_id    BIGINT         NOT NULL REFERENCES accounts(id)  ON DELETE CASCADE,
    year          SMALLINT       NOT NULL,
    month         SMALLINT       NOT NULL CHECK (month BETWEEN 1 AND 12),
    opening       NUMERIC(20, 4) NOT NULL DEFAULT 0,
    debit_total   NUMERIC(20, 4) NOT NULL DEFAULT 0,
    credit_total  NUMERIC(20, 4) NOT NULL DEFAULT 0,
    closing       NUMERIC(20, 4) NOT NULL DEFAULT 0,
    -- flag dirty: di-set true oleh trigger pada journal_lines insert, di-clear oleh worker
    is_dirty      BOOLEAN        NOT NULL DEFAULT false,
    refreshed_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),
    PRIMARY KEY (company_id, account_id, year, month)
);

COMMENT ON TABLE account_period_balance IS
    'Snapshot saldo per akun per bulan. Untuk laporan cepat tanpa recompute sejarah.';

CREATE INDEX IF NOT EXISTS apb_company_period_idx
    ON account_period_balance (company_id, year, month);

CREATE INDEX IF NOT EXISTS apb_dirty_idx
    ON account_period_balance (company_id, year, month)
    WHERE is_dirty = true;

-- -----------------------------------------------------------------------------
-- Trigger: mark dirty saat ada journal_line baru
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_jl_mark_balance_dirty() RETURNS TRIGGER AS $$
DECLARE
    v_year   SMALLINT;
    v_month  SMALLINT;
BEGIN
    SELECT EXTRACT(YEAR FROM posting_date)::SMALLINT,
           EXTRACT(MONTH FROM posting_date)::SMALLINT
      INTO v_year, v_month
      FROM journal_entries WHERE id = NEW.journal_entry_id;

    -- Upsert as dirty placeholder. Worker akan refresh nominal-nya.
    INSERT INTO account_period_balance
        (company_id, account_id, year, month, is_dirty)
    VALUES
        (NEW.company_id, NEW.account_id, v_year, v_month, true)
    ON CONFLICT (company_id, account_id, year, month)
    DO UPDATE SET is_dirty = true;

    RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS jl_mark_balance_dirty ON journal_lines;
CREATE TRIGGER jl_mark_balance_dirty
    AFTER INSERT ON journal_lines
    FOR EACH ROW EXECUTE FUNCTION trg_jl_mark_balance_dirty();

-- -----------------------------------------------------------------------------
-- Function: refresh nominal untuk satu (company, account, year, month)
-- Dipanggil worker BullMQ.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_account_period_balance(
    p_company_id BIGINT, p_account_id BIGINT, p_year SMALLINT, p_month SMALLINT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_opening  NUMERIC(20,4);
    v_debit    NUMERIC(20,4);
    v_credit   NUMERIC(20,4);
    v_normal   CHAR(1);
    v_closing  NUMERIC(20,4);
BEGIN
    -- Ambil normal_balance akun
    SELECT normal_balance INTO v_normal FROM accounts WHERE id = p_account_id;

    -- Opening = closing balance bulan sebelumnya (atau 0 jika tidak ada)
    SELECT closing INTO v_opening
      FROM account_period_balance
     WHERE company_id = p_company_id
       AND account_id = p_account_id
       AND (year * 12 + month) = (p_year * 12 + p_month - 1);

    IF v_opening IS NULL THEN
        v_opening := 0;
    END IF;

    -- Sum debit/credit dalam bulan ini
    SELECT
        COALESCE(SUM(jl.debit),  0),
        COALESCE(SUM(jl.credit), 0)
      INTO v_debit, v_credit
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
     WHERE jl.company_id = p_company_id
       AND jl.account_id = p_account_id
       AND EXTRACT(YEAR  FROM je.posting_date)::SMALLINT = p_year
       AND EXTRACT(MONTH FROM je.posting_date)::SMALLINT = p_month;

    -- Hitung closing berdasarkan normal balance
    IF v_normal = 'D' THEN
        v_closing := v_opening + v_debit - v_credit;
    ELSE
        v_closing := v_opening + v_credit - v_debit;
    END IF;

    INSERT INTO account_period_balance
        (company_id, account_id, year, month, opening, debit_total, credit_total, closing,
         is_dirty, refreshed_at)
    VALUES
        (p_company_id, p_account_id, p_year, p_month, v_opening, v_debit, v_credit, v_closing,
         false, now())
    ON CONFLICT (company_id, account_id, year, month)
    DO UPDATE SET
        opening      = EXCLUDED.opening,
        debit_total  = EXCLUDED.debit_total,
        credit_total = EXCLUDED.credit_total,
        closing      = EXCLUDED.closing,
        is_dirty     = false,
        refreshed_at = now();
END $$;

COMMENT ON FUNCTION refresh_account_period_balance IS
    'Recompute opening/debit/credit/closing untuk satu cell. Dipanggil worker BullMQ.';
