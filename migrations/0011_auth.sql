-- =============================================================================
-- 0011_auth.sql
-- Authentication support: refresh tokens, password reset, account lockout.
-- =============================================================================

SET search_path TO eccounting, public;

-- -----------------------------------------------------------------------------
-- USERS: tambah kolom untuk auth security
-- -----------------------------------------------------------------------------

-- Lockout fields (anti brute-force)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS failed_login_count SMALLINT     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Mark hash algorithm — lazy migration dari bcrypt v1 (`$2y$`) ke argon2id
-- Detect dari prefix hash, kolom ini cache untuk kemudahan query
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash_algo TEXT NOT NULL DEFAULT 'argon2id'
        CHECK (password_hash_algo IN ('argon2id', 'bcrypt'));

COMMENT ON COLUMN users.failed_login_count   IS 'Counter consecutive failed login. Reset ke 0 setelah success login.';
COMMENT ON COLUMN users.locked_until         IS 'Jika now() < locked_until, semua login attempt ditolak.';
COMMENT ON COLUMN users.password_changed_at  IS 'Timestamp ganti password terakhir. Untuk force-rotation policy.';
COMMENT ON COLUMN users.password_hash_algo   IS 'Algoritma hash. v1 import = bcrypt, user baru / change password = argon2id.';

-- -----------------------------------------------------------------------------
-- REFRESH TOKENS
-- One row per device/session. Token disimpan hash-nya saja (SHA-256).
-- Saat refresh: rotate (insert new, mark old as revoked) untuk detect replay.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id              BIGSERIAL    PRIMARY KEY,
    user_id         BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      BYTEA        NOT NULL,                       -- sha256(token)
    issued_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ  NOT NULL,
    revoked_at      TIMESTAMPTZ,
    revoked_reason  TEXT,
    replaced_by_id  BIGINT       REFERENCES refresh_tokens(id) ON DELETE SET NULL,
    user_agent      TEXT,
    ip_address      INET,
    UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx
    ON refresh_tokens (user_id)
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS refresh_tokens_expires_idx
    ON refresh_tokens (expires_at)
    WHERE revoked_at IS NULL;

COMMENT ON TABLE refresh_tokens IS 'Refresh token storage. Disimpan sebagai sha256 hash, rotate per refresh.';

-- -----------------------------------------------------------------------------
-- PASSWORD RESET TOKENS
-- Token untuk reset password lewat email link. Single-use, expire 1 hour default.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  BYTEA        NOT NULL,                            -- sha256(token)
    issued_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ  NOT NULL,
    used_at     TIMESTAMPTZ,                                      -- once consumed, cannot reuse
    requested_ip INET,
    UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_active_idx
    ON password_reset_tokens (user_id)
    WHERE used_at IS NULL;

COMMENT ON TABLE password_reset_tokens IS 'Token reset password. Single-use, expire 1 jam default.';

-- -----------------------------------------------------------------------------
-- RLS: refresh_tokens & password_reset_tokens
-- Tabel ini cross-firm (untuk auth pre-context), pakai role-based filter di app.
-- Tidak diaktifkan RLS pada table ini karena diakses sebelum tenant context ada.
-- -----------------------------------------------------------------------------
