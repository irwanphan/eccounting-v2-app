-- =============================================================================
-- 0010_indexes.sql
-- Composite indexes untuk pola query yang sering muncul di laporan akuntansi.
-- Indexes lain yang sudah dibuat inline di migration tabel masing-masing tidak
-- diulang di sini.
-- =============================================================================

SET search_path TO eccounting, public;

-- -----------------------------------------------------------------------------
-- Buku besar (ledger): jurnal per akun dalam range tanggal
-- Query pola:
--   SELECT * FROM journal_lines jl
--    JOIN journal_entries je ON je.id = jl.journal_entry_id
--   WHERE jl.company_id = ? AND jl.account_id = ?
--     AND je.posting_date BETWEEN ? AND ?
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS jl_company_account_entry_idx
    ON journal_lines (company_id, account_id, journal_entry_id);

CREATE INDEX IF NOT EXISTS je_company_posting_id_idx
    ON journal_entries (company_id, posting_date, id);

-- -----------------------------------------------------------------------------
-- Neraca saldo & laporan periode: agregasi per akun per periode
-- account_period_balance sudah punya PK (company_id, account_id, year, month)
-- Tambah index untuk filter "semua akun dalam periode X"
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS apb_company_year_month_idx
    ON account_period_balance (company_id, year, month);

-- -----------------------------------------------------------------------------
-- Pencarian jurnal teks (deskripsi)
-- Gunakan trigram untuk LIKE '%kata%' yang cepat
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS je_description_trgm_idx
    ON journal_entries USING GIN (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS jl_description_trgm_idx
    ON journal_lines USING GIN (description gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- Lookup posting_number cepat
-- -----------------------------------------------------------------------------
-- Sudah ada UNIQUE (company_id, posting_number), tidak perlu tambahan.

-- -----------------------------------------------------------------------------
-- Reference field (untuk filter "jurnal yang refer dokumen X")
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS jl_company_reference_idx
    ON journal_lines (company_id, reference)
    WHERE reference IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Statistics target tuning untuk kolom yang banyak distinct value
-- -----------------------------------------------------------------------------
ALTER TABLE journal_entries ALTER COLUMN company_id   SET STATISTICS 1000;
ALTER TABLE journal_entries ALTER COLUMN posting_date SET STATISTICS 1000;
ALTER TABLE journal_lines   ALTER COLUMN company_id   SET STATISTICS 1000;
ALTER TABLE journal_lines   ALTER COLUMN account_id   SET STATISTICS 1000;

-- Trigger statistics update (akan re-collect saat next ANALYZE)
ANALYZE journal_entries;
ANALYZE journal_lines;
ANALYZE account_period_balance;
