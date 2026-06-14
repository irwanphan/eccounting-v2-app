-- =============================================================================
-- 0008_import_audit.sql
--   1. import_batches  — idempotent batch import (file SHA256 sebagai natural key)
--   2. audit_log       — append-only, hash-chained tamper-evident audit trail
-- =============================================================================

SET search_path TO eccounting, public;

-- -----------------------------------------------------------------------------
-- 1. IMPORT_BATCHES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS import_batches (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT       NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    file_name       TEXT         NOT NULL,
    file_sha256     CHAR(64)     NOT NULL,
    storage_key     TEXT         NOT NULL,    -- key di S3/MinIO
    total_rows      INT          NOT NULL DEFAULT 0,
    success_rows    INT          NOT NULL DEFAULT 0,
    failed_rows     INT          NOT NULL DEFAULT 0,
    status          TEXT         NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'done', 'done_with_errors', 'failed')),
    error_summary   JSONB,
    created_by      BIGINT       NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    UNIQUE (company_id, file_sha256)
);

COMMENT ON TABLE import_batches IS
    'Idempotent import. UNIQUE (company_id, file_sha256) → replay aman.';

CREATE INDEX IF NOT EXISTS import_batches_company_status_idx
    ON import_batches (company_id, status, created_at DESC);

-- Tambahkan FK dari journal_entries.import_batch_id (sebelumnya ditunda di 0005)
ALTER TABLE journal_entries
    ADD CONSTRAINT je_import_batch_fk
        FOREIGN KEY (import_batch_id) REFERENCES import_batches(id) ON DELETE RESTRICT;

-- -----------------------------------------------------------------------------
-- 2. AUDIT_LOG (append-only, hash-chained)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id                BIGSERIAL PRIMARY KEY,
    firm_id           BIGINT,
    company_id        BIGINT,
    actor_user_id     BIGINT       REFERENCES users(id),
    action            TEXT         NOT NULL,    -- e.g. 'journal.post', 'period.close', 'user.login'
    entity_type       TEXT,                     -- e.g. 'journal_entry', 'account', 'user'
    entity_id         BIGINT,
    old_values        JSONB,
    new_values        JSONB,
    ip_address        INET,
    user_agent        TEXT,
    request_id        TEXT,                     -- correlation ID dari NestJS

    -- Hash chain: prev_hash = hash sebelumnya dalam scope (firm), row_hash = hash row ini.
    -- Verifikasi: untuk setiap row, hash(prev_hash || row_data) harus = row_hash.
    prev_hash         CHAR(64),
    row_hash          CHAR(64)     NOT NULL,

    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE audit_log IS
    'Append-only audit trail dengan hash chain. UPDATE/DELETE direvoke.';

CREATE INDEX IF NOT EXISTS audit_company_idx
    ON audit_log (company_id, created_at DESC)
    WHERE company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_firm_idx
    ON audit_log (firm_id, created_at DESC)
    WHERE firm_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_actor_idx
    ON audit_log (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_entity_idx
    ON audit_log (entity_type, entity_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Trigger: maintain hash chain otomatis pada INSERT
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_audit_hash_chain() RETURNS TRIGGER AS $$
DECLARE
    v_prev_hash  CHAR(64);
    v_payload    TEXT;
BEGIN
    -- Ambil hash terakhir di scope firm (atau global jika firm_id null)
    SELECT row_hash INTO v_prev_hash
      FROM audit_log
     WHERE (NEW.firm_id IS NULL AND firm_id IS NULL)
        OR (NEW.firm_id IS NOT NULL AND firm_id = NEW.firm_id)
     ORDER BY id DESC
     LIMIT 1;

    NEW.prev_hash := v_prev_hash;  -- bisa NULL kalau ini row pertama

    -- Susun payload deterministic, lalu sha256
    v_payload := COALESCE(v_prev_hash, '') || '|' ||
                 COALESCE(NEW.firm_id::text, '') || '|' ||
                 COALESCE(NEW.company_id::text, '') || '|' ||
                 COALESCE(NEW.actor_user_id::text, '') || '|' ||
                 NEW.action || '|' ||
                 COALESCE(NEW.entity_type, '') || '|' ||
                 COALESCE(NEW.entity_id::text, '') || '|' ||
                 COALESCE(NEW.old_values::text, '') || '|' ||
                 COALESCE(NEW.new_values::text, '') || '|' ||
                 COALESCE(NEW.ip_address::text, '') || '|' ||
                 COALESCE(NEW.request_id, '') || '|' ||
                 COALESCE(NEW.created_at, now())::text;

    NEW.row_hash := encode(digest(v_payload, 'sha256'), 'hex');

    RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_hash_chain ON audit_log;
CREATE TRIGGER audit_hash_chain
    BEFORE INSERT ON audit_log
    FOR EACH ROW EXECUTE FUNCTION trg_audit_hash_chain();

-- -----------------------------------------------------------------------------
-- Immutability: revoke UPDATE/DELETE
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS audit_no_update ON audit_log;
CREATE TRIGGER audit_no_update
    BEFORE UPDATE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION trg_reject_mutation();

DROP TRIGGER IF EXISTS audit_no_delete ON audit_log;
CREATE TRIGGER audit_no_delete
    BEFORE DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION trg_reject_mutation();

REVOKE UPDATE, DELETE ON audit_log FROM app_user, app_admin;

-- -----------------------------------------------------------------------------
-- Function: verify integrity dari audit log (untuk forensics / sanity check)
-- Mengembalikan baris pertama yang putus hash chain-nya, atau NULL kalau OK.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION verify_audit_chain(p_firm_id BIGINT)
    RETURNS BIGINT
    LANGUAGE plpgsql
    STABLE
AS $$
DECLARE
    r            RECORD;
    v_prev_hash  CHAR(64);
    v_payload    TEXT;
    v_expected   CHAR(64);
BEGIN
    v_prev_hash := NULL;
    FOR r IN
        SELECT * FROM audit_log
         WHERE (p_firm_id IS NULL AND firm_id IS NULL)
            OR (p_firm_id IS NOT NULL AND firm_id = p_firm_id)
         ORDER BY id ASC
    LOOP
        v_payload := COALESCE(v_prev_hash, '') || '|' ||
                     COALESCE(r.firm_id::text, '') || '|' ||
                     COALESCE(r.company_id::text, '') || '|' ||
                     COALESCE(r.actor_user_id::text, '') || '|' ||
                     r.action || '|' ||
                     COALESCE(r.entity_type, '') || '|' ||
                     COALESCE(r.entity_id::text, '') || '|' ||
                     COALESCE(r.old_values::text, '') || '|' ||
                     COALESCE(r.new_values::text, '') || '|' ||
                     COALESCE(r.ip_address::text, '') || '|' ||
                     COALESCE(r.request_id, '') || '|' ||
                     r.created_at::text;

        v_expected := encode(digest(v_payload, 'sha256'), 'hex');

        IF v_expected <> r.row_hash THEN
            RETURN r.id;   -- baris ini broken
        END IF;

        v_prev_hash := r.row_hash;
    END LOOP;

    RETURN NULL;  -- chain valid
END $$;

COMMENT ON FUNCTION verify_audit_chain IS
    'Verify hash chain audit log. Return id baris pertama yang corrupt, atau NULL jika OK.';
