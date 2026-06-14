-- =============================================================================
-- 0003_core_tables.sql
-- Tabel inti: firms, users, companies, company_members
-- =============================================================================

SET search_path TO eccounting, public;

-- -----------------------------------------------------------------------------
-- FIRMS
-- Kantor konsultan. Untuk skenario single-firm, akan diisi 1 row default.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS firms (
    id           BIGSERIAL PRIMARY KEY,
    name         TEXT        NOT NULL,
    npwp         VARCHAR(20),
    address      TEXT,
    phone        VARCHAR(32),
    email        CITEXT,
    timezone     TEXT        NOT NULL DEFAULT 'Asia/Jakarta',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE firms IS 'Kantor konsultan pajak (tenant level-1). Single firm = 1 row.';

-- -----------------------------------------------------------------------------
-- USERS
-- Anggota firma. Login pakai email + password_hash (argon2id/bcrypt di app).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    firm_id         BIGINT      NOT NULL REFERENCES firms(id) ON DELETE RESTRICT,
    email           CITEXT      NOT NULL,
    password_hash   TEXT        NOT NULL,
    name            TEXT        NOT NULL,
    is_active       BOOLEAN     NOT NULL DEFAULT true,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (firm_id, email)
);

COMMENT ON TABLE users IS 'Anggota firma konsultan. Login dengan email + password.';

-- -----------------------------------------------------------------------------
-- COMPANIES
-- Pembukuan klien yang dikelola konsultan. INI tenant utama untuk RLS.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
    id                       BIGSERIAL PRIMARY KEY,
    firm_id                  BIGINT       NOT NULL REFERENCES firms(id) ON DELETE RESTRICT,
    name                     TEXT         NOT NULL,
    npwp                     VARCHAR(20),
    address                  TEXT,
    phone                    VARCHAR(32),
    email                    CITEXT,
    base_currency            CHAR(3)      NOT NULL DEFAULT 'IDR',
    fiscal_year_start_month  SMALLINT     NOT NULL DEFAULT 1
        CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
    -- pengaturan posting number
    posting_number_prefix    TEXT         NOT NULL DEFAULT 'JU',
    -- soft archive (bukan delete, untuk audit)
    archived_at              TIMESTAMPTZ,
    created_by               BIGINT       REFERENCES users(id),
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE companies IS 'Pembukuan klien (tenant utama). Semua data akuntansi di-scope di sini.';

CREATE INDEX IF NOT EXISTS companies_firm_active_idx
    ON companies (firm_id)
    WHERE archived_at IS NULL;

-- -----------------------------------------------------------------------------
-- COMPANY_MEMBERS
-- Mapping user ↔ company dengan role. Menentukan siapa boleh akses pembukuan
-- mana, dan dengan privilege apa.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_members (
    company_id   BIGINT      NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id      BIGINT      NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
    role         TEXT        NOT NULL CHECK (role IN ('owner', 'accountant', 'viewer')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (company_id, user_id)
);

CREATE INDEX IF NOT EXISTS company_members_user_idx ON company_members (user_id);

COMMENT ON TABLE company_members IS 'Mapping user ↔ company dengan role. Sumber kebenaran authorization.';

-- -----------------------------------------------------------------------------
-- TRIGGER untuk maintain updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER firms_set_updated_at      BEFORE UPDATE ON firms      FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER users_set_updated_at      BEFORE UPDATE ON users      FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER companies_set_updated_at  BEFORE UPDATE ON companies  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
