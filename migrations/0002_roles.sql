-- =============================================================================
-- 0002_roles.sql
-- Database roles untuk pemisahan privilege.
--
-- Strategi:
--   - app_owner: pemilik schema, jalankan migrations (DDL). Tidak dipakai aplikasi runtime.
--   - app_user:  dipakai oleh aplikasi NestJS untuk request normal. Tidak boleh
--                UPDATE/DELETE journal_entries / journal_lines (append-only).
--                Tidak boleh DELETE audit_log.
--   - app_admin: dipakai oleh worker khusus (mis. archival, reconciliation).
--                Bisa lebih dari app_user, tapi tetap tidak boleh ubah audit_log.
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_owner') THEN
        CREATE ROLE app_owner LOGIN PASSWORD 'change_me_in_env';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user LOGIN PASSWORD 'change_me_in_env';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_admin') THEN
        CREATE ROLE app_admin LOGIN PASSWORD 'change_me_in_env';
    END IF;
END $$;

-- Buat schema khusus untuk aplikasi (opsional tapi clean)
CREATE SCHEMA IF NOT EXISTS eccounting AUTHORIZATION app_owner;

-- Default search path supaya tidak perlu prefix schema setiap query
ALTER ROLE app_user  SET search_path TO eccounting, public;
ALTER ROLE app_admin SET search_path TO eccounting, public;
ALTER ROLE app_owner SET search_path TO eccounting, public;

-- Privilege di schema
GRANT USAGE  ON SCHEMA eccounting TO app_user, app_admin;
GRANT CREATE ON SCHEMA eccounting TO app_owner;

-- Default privileges: setiap tabel baru otomatis grant ke app_user/app_admin
ALTER DEFAULT PRIVILEGES IN SCHEMA eccounting
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA eccounting
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA eccounting
    GRANT USAGE, SELECT ON SEQUENCES TO app_user, app_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA eccounting
    GRANT EXECUTE ON FUNCTIONS TO app_user, app_admin;

-- Catatan: REVOKE UPDATE/DELETE pada journal_entries, journal_lines, audit_log
-- akan dilakukan di migration setelah tabel dibuat (0006 & 0008).
