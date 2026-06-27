-- =============================================================================
-- 0001_extensions.sql
-- PostgreSQL extensions yang dibutuhkan Eccounting v2
-- =============================================================================

-- citext: untuk email case-insensitive
CREATE EXTENSION IF NOT EXISTS citext;

-- ltree: untuk hierarchical query COA (chart of accounts)
CREATE EXTENSION IF NOT EXISTS ltree;

-- btree_gist: enable GIST index pada kolom bigint/text (untuk index composite (company_id, path))
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- pgcrypto: untuk gen_random_uuid(), digest() (audit hash chain), crypt() (password hashing alternatif)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- pg_stat_statements: untuk performance monitoring (opsional, tapi sangat berguna)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
