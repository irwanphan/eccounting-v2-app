-- =============================================================================
-- 0006_ledger_constraints.sql
-- Constraint & trigger yang menegakkan aturan akuntansi:
--   1. Balanced double-entry (Σdebit = Σcredit per journal_entry) — DEFERRABLE
--   2. Posting hanya ke period yang status='open'
--   3. journal_entries & journal_lines IMMUTABLE (no UPDATE, no DELETE)
--   4. account harus is_postable=true
-- =============================================================================

SET search_path TO eccounting, public;

-- -----------------------------------------------------------------------------
-- 1. BALANCED DOUBLE-ENTRY CHECK (deferrable, fires at COMMIT)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_je_must_balance() RETURNS TRIGGER AS $$
DECLARE
    total_debit  NUMERIC(20,4);
    total_credit NUMERIC(20,4);
    line_count   INT;
BEGIN
    SELECT
        COALESCE(SUM(debit), 0),
        COALESCE(SUM(credit), 0),
        COUNT(*)
      INTO total_debit, total_credit, line_count
      FROM journal_lines
     WHERE journal_entry_id = NEW.id;

    IF line_count < 2 THEN
        RAISE EXCEPTION
            'JOURNAL_INSUFFICIENT_LINES: journal_entry % must have at least 2 lines (got %)',
            NEW.id, line_count;
    END IF;

    IF total_debit <> total_credit THEN
        RAISE EXCEPTION
            'JOURNAL_UNBALANCED: journal_entry % is not balanced (debit=%, credit=%)',
            NEW.id, total_debit, total_credit;
    END IF;

    IF total_debit = 0 THEN
        RAISE EXCEPTION
            'JOURNAL_ZERO_AMOUNT: journal_entry % has zero total', NEW.id;
    END IF;

    RETURN NEW;
END $$ LANGUAGE plpgsql;

-- Constraint trigger — fires at COMMIT (deferred), bukan setelah tiap statement.
-- Ini penting: aplikasi insert entry → insert lines → commit.
-- Saat commit, baru cek balance.
DROP TRIGGER IF EXISTS je_balance_check ON journal_entries;
CREATE CONSTRAINT TRIGGER je_balance_check
    AFTER INSERT ON journal_entries
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION trg_je_must_balance();

-- -----------------------------------------------------------------------------
-- 2. PERIOD-OPEN CHECK (sebelum insert)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_je_period_must_be_open() RETURNS TRIGGER AS $$
DECLARE
    v_status TEXT;
BEGIN
    v_status := get_period_status(NEW.company_id, NEW.posting_date);

    IF v_status IS NULL THEN
        RAISE EXCEPTION
            'PERIOD_NOT_FOUND: accounting period for company % posting_date % belum dibuat',
            NEW.company_id, NEW.posting_date;
    END IF;

    IF v_status <> 'open' THEN
        RAISE EXCEPTION
            'PERIOD_NOT_OPEN: accounting period for company % posting_date % status=% (harus open)',
            NEW.company_id, NEW.posting_date, v_status;
    END IF;

    RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS je_period_check ON journal_entries;
CREATE TRIGGER je_period_check
    BEFORE INSERT ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION trg_je_period_must_be_open();

-- -----------------------------------------------------------------------------
-- 3. IMMUTABILITY — journal_entries & journal_lines tidak boleh UPDATE/DELETE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_reject_mutation() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'IMMUTABLE_TABLE: % is append-only. Use reversal entry for corrections.',
        TG_TABLE_NAME;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS je_no_update ON journal_entries;
CREATE TRIGGER je_no_update
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION trg_reject_mutation();

DROP TRIGGER IF EXISTS je_no_delete ON journal_entries;
CREATE TRIGGER je_no_delete
    BEFORE DELETE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION trg_reject_mutation();

DROP TRIGGER IF EXISTS jl_no_update ON journal_lines;
CREATE TRIGGER jl_no_update
    BEFORE UPDATE ON journal_lines
    FOR EACH ROW EXECUTE FUNCTION trg_reject_mutation();

DROP TRIGGER IF EXISTS jl_no_delete ON journal_lines;
CREATE TRIGGER jl_no_delete
    BEFORE DELETE ON journal_lines
    FOR EACH ROW EXECUTE FUNCTION trg_reject_mutation();

-- Defense in depth: revoke privilege juga di role level.
-- (Trigger di atas berlaku siapa saja termasuk superuser kecuali SESSION REPLICATION).
REVOKE UPDATE, DELETE ON journal_entries FROM app_user, app_admin;
REVOKE UPDATE, DELETE ON journal_lines   FROM app_user, app_admin;

-- -----------------------------------------------------------------------------
-- 4. POSTABLE ACCOUNT CHECK
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_jl_account_must_be_postable() RETURNS TRIGGER AS $$
DECLARE
    v_postable     BOOLEAN;
    v_archived_at  TIMESTAMPTZ;
    v_account_co   BIGINT;
BEGIN
    SELECT is_postable, archived_at, company_id
      INTO v_postable, v_archived_at, v_account_co
      FROM accounts WHERE id = NEW.account_id;

    IF v_postable IS NULL THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: account % not found', NEW.account_id;
    END IF;

    IF v_account_co <> NEW.company_id THEN
        RAISE EXCEPTION 'ACCOUNT_WRONG_TENANT: account % belongs to company %, not %',
            NEW.account_id, v_account_co, NEW.company_id;
    END IF;

    IF v_archived_at IS NOT NULL THEN
        RAISE EXCEPTION 'ACCOUNT_ARCHIVED: account % is archived', NEW.account_id;
    END IF;

    IF NOT v_postable THEN
        RAISE EXCEPTION 'ACCOUNT_NOT_POSTABLE: account % is a parent/header account', NEW.account_id;
    END IF;

    RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS jl_account_check ON journal_lines;
CREATE TRIGGER jl_account_check
    BEFORE INSERT ON journal_lines
    FOR EACH ROW EXECUTE FUNCTION trg_jl_account_must_be_postable();

-- -----------------------------------------------------------------------------
-- BONUS: deferrability — application bisa pakai
--     SET CONSTRAINTS je_balance_check IMMEDIATE
-- untuk fail fast saat unit testing.
-- -----------------------------------------------------------------------------
