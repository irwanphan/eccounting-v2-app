-- =============================================================================
-- 0004_accounts_periods.sql
-- Chart of Accounts (COA) + accounting periods (period close)
-- =============================================================================

SET search_path TO eccounting, public;

-- -----------------------------------------------------------------------------
-- ACCOUNTS (COA per company, hierarchical lewat ltree)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT       NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    parent_id       BIGINT       REFERENCES accounts(id) ON DELETE RESTRICT,
    code            VARCHAR(32)  NOT NULL,
    name            TEXT         NOT NULL,

    -- klasifikasi akuntansi standar
    category        TEXT         NOT NULL CHECK (category IN (
                        'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE',
                        'COGS', 'OTHER_INCOME', 'OTHER_EXPENSE', 'TAX_EXPENSE'
                    )),

    -- sub-kategori opsional (untuk laporan laba rugi struktur Indonesia)
    sub_category    TEXT,

    normal_balance  CHAR(1)      NOT NULL CHECK (normal_balance IN ('D', 'C')),

    -- akun yang bisa di-post (daun di tree). Akun parent biasanya tidak bisa di-post.
    is_postable     BOOLEAN      NOT NULL DEFAULT true,

    -- depth di tree (di-maintain trigger)
    level           SMALLINT     NOT NULL DEFAULT 0,

    -- materialized path untuk query subtree cepat (ltree)
    path            LTREE,

    -- flag khusus (misal: akun "Laba Rugi Periode Berjalan")
    is_retained_earning BOOLEAN  NOT NULL DEFAULT false,

    archived_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

    UNIQUE (company_id, code)
);

COMMENT ON TABLE accounts IS 'Chart of Accounts per company. Code unique per company (bukan global).';

-- Index untuk lookup hierarki
CREATE INDEX IF NOT EXISTS accounts_company_path_gist
    ON accounts USING GIST (company_id, path);

CREATE INDEX IF NOT EXISTS accounts_company_parent_idx
    ON accounts (company_id, parent_id);

CREATE INDEX IF NOT EXISTS accounts_company_category_idx
    ON accounts (company_id, category)
    WHERE archived_at IS NULL;

-- Maintain level & path saat insert/update parent_id
CREATE OR REPLACE FUNCTION trg_account_set_path() RETURNS TRIGGER AS $$
DECLARE
    parent_path  LTREE;
    parent_level SMALLINT;
BEGIN
    IF NEW.parent_id IS NULL THEN
        NEW.level := 0;
        NEW.path  := text2ltree(NEW.id::text);
    ELSE
        SELECT path, level INTO parent_path, parent_level
            FROM accounts WHERE id = NEW.parent_id;

        IF parent_path IS NULL THEN
            -- parent baru, belum punya path (kasus seed). Tunda: assign id-only.
            NEW.path  := text2ltree(NEW.id::text);
            NEW.level := parent_level + 1;
        ELSE
            NEW.level := parent_level + 1;
            NEW.path  := parent_path || text2ltree(NEW.id::text);
        END IF;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

-- Trigger BEFORE INSERT/UPDATE pada parent_id
CREATE TRIGGER accounts_set_path
    BEFORE INSERT OR UPDATE OF parent_id ON accounts
    FOR EACH ROW EXECUTE FUNCTION trg_account_set_path();

CREATE TRIGGER accounts_set_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- -----------------------------------------------------------------------------
-- ACCOUNTING_PERIODS
-- Period status: open → closed → locked. Posting hanya boleh ke 'open'.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounting_periods (
    id           BIGSERIAL PRIMARY KEY,
    company_id   BIGINT       NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    year         SMALLINT     NOT NULL CHECK (year BETWEEN 2000 AND 2200),
    month        SMALLINT     NOT NULL CHECK (month BETWEEN 1 AND 12),
    status       TEXT         NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'locked')),
    closed_at    TIMESTAMPTZ,
    closed_by    BIGINT       REFERENCES users(id),
    locked_at    TIMESTAMPTZ,
    locked_by    BIGINT       REFERENCES users(id),
    note         TEXT,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (company_id, year, month)
);

CREATE INDEX IF NOT EXISTS accounting_periods_company_idx
    ON accounting_periods (company_id, year, month);

CREATE TRIGGER accounting_periods_set_updated_at
    BEFORE UPDATE ON accounting_periods
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- Helper function: ambil status period untuk tanggal tertentu
CREATE OR REPLACE FUNCTION get_period_status(p_company_id BIGINT, p_date DATE)
    RETURNS TEXT
    LANGUAGE plpgsql
    STABLE
AS $$
DECLARE
    v_status TEXT;
BEGIN
    SELECT status INTO v_status
        FROM accounting_periods
        WHERE company_id = p_company_id
          AND year = EXTRACT(YEAR FROM p_date)::SMALLINT
          AND month = EXTRACT(MONTH FROM p_date)::SMALLINT;
    RETURN v_status; -- NULL jika period belum dibuat
END $$;
