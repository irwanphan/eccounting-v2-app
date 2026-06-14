-- =============================================================================
-- 0005_ledger.sql
-- Core ledger: journal_entries (header) + journal_lines (debit/credit lines)
-- =============================================================================

SET search_path TO eccounting, public;

-- -----------------------------------------------------------------------------
-- JOURNAL_ENTRIES (header jurnal — APPEND ONLY)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_entries (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT       NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    posting_number      TEXT         NOT NULL,
    posting_date        DATE         NOT NULL,
    transaction_date    DATE         NOT NULL,
    description         TEXT,
    -- sumber posting
    source              TEXT         NOT NULL CHECK (source IN (
                            'manual', 'cash', 'import', 'reversal', 'adjustment',
                            'opening', 'closing', 'system'
                        )),
    -- jika ini reversal, tunjuk entry asli
    reversal_of_id      BIGINT       REFERENCES journal_entries(id),
    -- jika ini hasil import Excel
    import_batch_id     BIGINT,  -- FK ditambah di 0008 setelah import_batches dibuat
    created_by          BIGINT       NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),

    UNIQUE (company_id, posting_number)
);

COMMENT ON TABLE journal_entries IS
    'Header jurnal. APPEND ONLY. Koreksi via reversal entry, bukan UPDATE/DELETE.';

CREATE INDEX IF NOT EXISTS je_company_posting_date_idx
    ON journal_entries (company_id, posting_date);

CREATE INDEX IF NOT EXISTS je_company_transaction_date_idx
    ON journal_entries (company_id, transaction_date);

CREATE INDEX IF NOT EXISTS je_company_source_idx
    ON journal_entries (company_id, source);

CREATE INDEX IF NOT EXISTS je_company_import_batch_idx
    ON journal_entries (company_id, import_batch_id)
    WHERE import_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS je_reversal_idx
    ON journal_entries (reversal_of_id)
    WHERE reversal_of_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- JOURNAL_LINES (debit/credit lines — APPEND ONLY)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_lines (
    id                  BIGSERIAL PRIMARY KEY,
    journal_entry_id    BIGINT         NOT NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,
    -- DENORMALIZED untuk performance RLS & query laporan
    company_id          BIGINT         NOT NULL REFERENCES companies(id),
    account_id          BIGINT         NOT NULL REFERENCES accounts(id),
    line_no             SMALLINT       NOT NULL CHECK (line_no >= 1),

    debit               NUMERIC(20, 4) NOT NULL DEFAULT 0 CHECK (debit  >= 0),
    credit              NUMERIC(20, 4) NOT NULL DEFAULT 0 CHECK (credit >= 0),

    reference           TEXT,
    description         TEXT,
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),

    -- Tepatnya: salah satu (debit atau credit) HARUS 0, dan satunya HARUS > 0
    CONSTRAINT jl_one_side CHECK ((debit = 0) <> (credit = 0)),

    UNIQUE (journal_entry_id, line_no)
);

COMMENT ON TABLE journal_lines IS
    'Lines (sisi debit/credit) jurnal. Tiap row HARUS punya tepat satu sisi terisi.';

CREATE INDEX IF NOT EXISTS jl_company_account_idx
    ON journal_lines (company_id, account_id);

CREATE INDEX IF NOT EXISTS jl_entry_idx
    ON journal_lines (journal_entry_id);

CREATE INDEX IF NOT EXISTS jl_company_account_date_idx
    ON journal_lines (company_id, account_id, journal_entry_id);

-- Trigger: maintain company_id di journal_lines harus sama dengan journal_entries.company_id
-- Ini second line of defense — application juga harus set, tapi DB jadi safety net.
CREATE OR REPLACE FUNCTION trg_jl_sync_company() RETURNS TRIGGER AS $$
DECLARE
    v_company_id BIGINT;
BEGIN
    SELECT company_id INTO v_company_id FROM journal_entries WHERE id = NEW.journal_entry_id;
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'journal_entry % not found', NEW.journal_entry_id;
    END IF;
    IF NEW.company_id IS NULL THEN
        NEW.company_id := v_company_id;
    ELSIF NEW.company_id <> v_company_id THEN
        RAISE EXCEPTION 'journal_line.company_id (%) mismatch with journal_entry.company_id (%)',
            NEW.company_id, v_company_id;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER jl_sync_company
    BEFORE INSERT ON journal_lines
    FOR EACH ROW EXECUTE FUNCTION trg_jl_sync_company();
