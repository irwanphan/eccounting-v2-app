-- =============================================================================
-- coa_default_indonesia.sql
-- Seed COA standar Indonesia per company baru.
--
-- Dipanggil saat company baru dibuat:
--   SELECT seed_default_coa(<company_id>);
--
-- Struktur:
--   - Level 1 (X000-000): kategori utama (Aset, Kewajiban, Equity, Pendapatan, dll.)
--   - Level 2 (XX00-000): sub-kategori
--   - Level 3 (XXX0-000): kelompok akun (header, is_postable=false)
--   - Leaf  (XXXX-NNN, NNN >= 001): akun postable
--
-- Sumber: adaptasi dari v1 `storage/coa-default/181022_001_COA_DEFAULT_SEED.csv`
-- =============================================================================

SET search_path TO eccounting, public;

-- -----------------------------------------------------------------------------
-- FUNCTION: seed_default_coa(p_company_id BIGINT)
-- Idempotent: gunakan ON CONFLICT DO NOTHING.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION seed_default_coa(p_company_id BIGINT)
    RETURNS INT
    LANGUAGE plpgsql
AS $$
DECLARE
    v_inserted_count INT := 0;
    v_coa            RECORD;
    v_parent_id      BIGINT;
BEGIN
    -- Temporary table untuk data seed
    CREATE TEMP TABLE _coa_seed (
        code           VARCHAR(32) PRIMARY KEY,
        parent_code    VARCHAR(32),
        name           TEXT         NOT NULL,
        category       TEXT         NOT NULL,
        normal_balance CHAR(1)      NOT NULL,
        is_postable    BOOLEAN      NOT NULL,
        is_retained_earning BOOLEAN NOT NULL DEFAULT false,
        sub_category   TEXT,
        ordering       INT          NOT NULL    -- urutan insert (parent dulu)
    ) ON COMMIT DROP;

    -- =========================================================================
    -- LEVEL 1: kategori utama
    -- =========================================================================
    INSERT INTO _coa_seed VALUES
        ('1000-000', NULL, 'Aset',                     'ASSET',         'D', false, false, NULL, 100),
        ('2000-000', NULL, 'Kewajiban',                'LIABILITY',     'C', false, false, NULL, 101),
        ('3000-000', NULL, 'Equity',                   'EQUITY',        'C', false, false, NULL, 102),
        ('4000-000', NULL, 'Pendapatan',               'REVENUE',       'C', false, false, NULL, 103),
        ('5000-000', NULL, 'Biaya atas Pendapatan',    'COGS',          'D', false, false, NULL, 104),
        ('6000-000', NULL, 'Biaya',                    'EXPENSE',       'D', false, false, NULL, 105),
        ('7000-000', NULL, 'Pendapatan di Luar Usaha', 'OTHER_INCOME',  'C', false, false, NULL, 106),
        ('8000-000', NULL, 'Beban di Luar Usaha',      'OTHER_EXPENSE', 'D', false, false, NULL, 107),
        ('9000-000', NULL, 'Pajak Penghasilan',        'TAX_EXPENSE',   'D', false, false, NULL, 108);

    -- =========================================================================
    -- LEVEL 2: sub-kategori
    -- =========================================================================
    INSERT INTO _coa_seed VALUES
        ('1100-000', '1000-000', 'Aset Lancar',                 'ASSET',         'D', false, false, NULL, 200),
        ('1200-000', '1000-000', 'Aset Tetap',                  'ASSET',         'D', false, false, NULL, 201),
        ('1300-000', '1000-000', 'Aset Lain-Lain',              'ASSET',         'D', false, false, NULL, 202),
        ('2100-000', '2000-000', 'Kewajiban Lancar',            'LIABILITY',     'C', false, false, NULL, 203),
        ('2200-000', '2000-000', 'Kewajiban Jangka Panjang',    'LIABILITY',     'C', false, false, NULL, 204),
        ('3100-000', '3000-000', 'Modal',                       'EQUITY',        'C', false, false, NULL, 205),
        ('4100-000', '4000-000', 'Pendapatan Usaha',            'REVENUE',       'C', false, false, NULL, 206),
        ('5100-000', '5000-000', 'Harga Pokok Penjualan',       'COGS',          'D', false, false, NULL, 207),
        ('6100-000', '6000-000', 'Biaya Operasional',           'EXPENSE',       'D', false, false, NULL, 208),
        ('6200-000', '6000-000', 'Biaya Non Operasional',       'EXPENSE',       'D', false, false, NULL, 209),
        ('7100-000', '7000-000', 'Pendapatan di Luar Usaha',    'OTHER_INCOME',  'C', false, false, NULL, 210),
        ('8100-000', '8000-000', 'Beban di Luar Usaha',         'OTHER_EXPENSE', 'D', false, false, NULL, 211),
        ('9100-000', '9000-000', 'Beban Pajak Penghasilan',     'TAX_EXPENSE',   'D', false, false, NULL, 212);

    -- =========================================================================
    -- LEVEL 3: kelompok akun
    -- =========================================================================
    INSERT INTO _coa_seed VALUES
        ('1110-000', '1100-000', 'Cash in Hand',              'ASSET',     'D', false, false, 'CASH', 300),
        ('1120-000', '1100-000', 'Bank',                      'ASSET',     'D', false, false, 'CASH', 301),
        ('1130-000', '1100-000', 'Piutang',                   'ASSET',     'D', false, false, 'PIUTANG', 302),
        ('1140-000', '1100-000', 'Piutang Pajak',             'ASSET',     'D', false, false, 'PIUTANG', 303),
        ('1150-000', '1100-000', 'Persediaan',                'ASSET',     'D', false, false, 'PERSEDIAAN', 304),
        ('1160-000', '1100-000', 'Aset Lancar Lainnya',       'ASSET',     'D', false, false, NULL, 305),
        ('1210-000', '1200-000', 'Aset Tetap Berwujud',       'ASSET',     'D', false, false, NULL, 306),
        ('1220-000', '1200-000', 'Akumulasi Penyusutan',      'ASSET',     'C', false, false, NULL, 307),
        ('1230-000', '1200-000', 'Aset Tetap Tidak Berwujud', 'ASSET',     'D', false, false, NULL, 308),
        ('1240-000', '1200-000', 'Akumulasi Amortisasi',      'ASSET',     'C', false, false, NULL, 309),
        ('1310-000', '1300-000', 'Aset Jangka Panjang Lainnya','ASSET',    'D', false, false, NULL, 310),
        ('2110-000', '2100-000', 'Utang Usaha',               'LIABILITY', 'C', false, false, NULL, 311),
        ('2120-000', '2100-000', 'Utang Pajak',               'LIABILITY', 'C', false, false, NULL, 312),
        ('2130-000', '2100-000', 'Kewajiban Lancar Lainnya',  'LIABILITY', 'C', false, false, NULL, 313),
        ('3110-000', '3100-000', 'Modal Usaha',               'EQUITY',    'C', false, false, NULL, 314),
        ('3120-000', '3100-000', 'Laba Ditahan',              'EQUITY',    'C', false, false, NULL, 315),
        ('6110-000', '6100-000', 'Beban Penjualan Langsung',  'EXPENSE',   'D', false, false, NULL, 316),
        ('6120-000', '6100-000', 'Biaya HRD',                 'EXPENSE',   'D', false, false, NULL, 317),
        ('6130-000', '6100-000', 'Biaya Administrasi dan Umum Lainnya', 'EXPENSE', 'D', false, false, NULL, 318),
        ('6140-000', '6100-000', 'Biaya Pajak',               'EXPENSE',   'D', false, false, NULL, 319),
        ('6150-000', '6100-000', 'Biaya Penyusutan dan Amortisasi', 'EXPENSE', 'D', false, false, NULL, 320),
        ('6160-000', '6100-000', 'Biaya Lainnya',             'EXPENSE',   'D', false, false, NULL, 321),
        ('6210-000', '6200-000', 'Biaya Non Operasional',     'EXPENSE',   'D', false, false, NULL, 322);

    -- =========================================================================
    -- LEAF: Cash in Hand (1110-XXX)
    -- =========================================================================
    INSERT INTO _coa_seed VALUES
        ('1110-001', '1110-000', 'Kas Besar', 'ASSET', 'D', true, false, 'CASH', 400),
        ('1110-002', '1110-000', 'Kas Kecil', 'ASSET', 'D', true, false, 'CASH', 401);

    -- =========================================================================
    -- LEAF: Bank (1120-XXX)
    -- =========================================================================
    INSERT INTO _coa_seed VALUES
        ('1120-001', '1120-000', 'Kas di Bank BCA',          'ASSET', 'D', true, false, 'CASH', 410),
        ('1120-002', '1120-000', 'Kas di Bank Mandiri',      'ASSET', 'D', true, false, 'CASH', 411),
        ('1120-003', '1120-000', 'Kas di Bank BNI',          'ASSET', 'D', true, false, 'CASH', 412),
        ('1120-004', '1120-000', 'Kas di Bank Maybank',      'ASSET', 'D', true, false, 'CASH', 413),
        ('1120-005', '1120-000', 'Kas di Bank CIMB Niaga',   'ASSET', 'D', true, false, 'CASH', 414),
        ('1120-006', '1120-000', 'Kas di Bank BRI',          'ASSET', 'D', true, false, 'CASH', 415),
        ('1120-007', '1120-000', 'Kas di Bank BTN',          'ASSET', 'D', true, false, 'CASH', 416),
        ('1120-008', '1120-000', 'Kas di Bank Artha Graha',  'ASSET', 'D', true, false, 'CASH', 417),
        ('1120-009', '1120-000', 'Kas di Bank BTPN',         'ASSET', 'D', true, false, 'CASH', 418),
        ('1120-010', '1120-000', 'Kas di Bank Commonwealth', 'ASSET', 'D', true, false, 'CASH', 419),
        ('1120-011', '1120-000', 'Kas di Bank Danamon',      'ASSET', 'D', true, false, 'CASH', 420),
        ('1120-012', '1120-000', 'Kas di Bank DBS',          'ASSET', 'D', true, false, 'CASH', 421),
        ('1120-013', '1120-000', 'Kas di Bank Mega',         'ASSET', 'D', true, false, 'CASH', 422),
        ('1120-014', '1120-000', 'Kas di Bank Nobu',         'ASSET', 'D', true, false, 'CASH', 423),
        ('1120-015', '1120-000', 'Kas di Bank Panin',        'ASSET', 'D', true, false, 'CASH', 424),
        ('1120-016', '1120-000', 'Kas di Bank Sinarmas',     'ASSET', 'D', true, false, 'CASH', 425),
        ('1120-017', '1120-000', 'Kas di Bank Citibank',     'ASSET', 'D', true, false, 'CASH', 426),
        ('1120-018', '1120-000', 'Kas di Bank Lainnya',      'ASSET', 'D', true, false, 'CASH', 427);

    -- =========================================================================
    -- LEAF: Piutang (1130-XXX)
    -- =========================================================================
    INSERT INTO _coa_seed VALUES
        ('1130-001', '1130-000', 'Piutang Dagang',                  'ASSET', 'D', true, false, 'PIUTANG', 430),
        ('1130-002', '1130-000', 'Piutang Wesel',                   'ASSET', 'D', true, false, 'PIUTANG', 431),
        ('1130-003', '1130-000', 'Piutang Karyawan',                'ASSET', 'D', true, false, 'PIUTANG', 432),
        ('1130-004', '1130-000', 'Piutang Afiliasi',                'ASSET', 'D', true, false, 'PIUTANG', 433),
        ('1130-005', '1130-000', 'Piutang Lain-lain',               'ASSET', 'D', true, false, 'PIUTANG', 434),
        ('1130-006', '1130-000', 'Cadangan Atas Kerugian Piutang',  'ASSET', 'C', true, false, 'PIUTANG', 435);

    -- =========================================================================
    -- LEAF: Piutang Pajak (1140-XXX)
    -- =========================================================================
    INSERT INTO _coa_seed VALUES
        ('1140-001', '1140-000', 'PPh Pasal 21',  'ASSET', 'D', true, false, 'PIUTANG', 440),
        ('1140-002', '1140-000', 'PPh Pasal 23',  'ASSET', 'D', true, false, 'PIUTANG', 441),
        ('1140-003', '1140-000', 'PPh Pasal 25',  'ASSET', 'D', true, false, 'PIUTANG', 442),
        ('1140-004', '1140-000', 'PPN Masukan',   'ASSET', 'D', true, false, 'PIUTANG', 443),
        ('1140-005', '1140-000', 'Piutang PPN',   'ASSET', 'D', true, false, 'PIUTANG', 444);

    -- =========================================================================
    -- LEAF: Persediaan (1150-XXX)
    -- =========================================================================
    INSERT INTO _coa_seed VALUES
        ('1150-001', '1150-000', 'Persediaan Barang Awal',  'ASSET', 'D', true, false, 'PERSEDIAAN', 450),
        ('1150-002', '1150-000', 'Persediaan Barang Akhir', 'ASSET', 'D', true, false, 'PERSEDIAAN', 451);

    -- =========================================================================
    -- LEAF: Aset Lancar Lainnya (1160-XXX)
    -- =========================================================================
    INSERT INTO _coa_seed VALUES
        ('1160-001', '1160-000', 'Perlengkapan Kantor',        'ASSET', 'D', true, false, 'ASET_LANCAR_LAINNYA',  460),
        ('1160-002', '1160-000', 'Uang Muka Pembelian',        'ASSET', 'D', true, false, 'ASET_LANCAR_LAINNYA',  461),
        ('1160-003', '1160-000', 'Asuransi Dibayar Di Muka',   'ASSET', 'D', true, false, 'BIAYA_DIBAYAR_DIMUKA', 462),
        ('1160-004', '1160-000', 'Sewa Dibayar Di Muka',       'ASSET', 'D', true, false, 'BIAYA_DIBAYAR_DIMUKA', 463),
        ('1160-005', '1160-000', 'Beban Dibayar Dimuka',       'ASSET', 'D', true, false, 'BIAYA_DIBAYAR_DIMUKA', 464);

    -- =========================================================================
    -- LEAF: Aset Tetap Berwujud (1210-XXX)
    -- =========================================================================
    INSERT INTO _coa_seed VALUES
        ('1210-001', '1210-000', 'Tanah',                    'ASSET', 'D', true, false, 'ASET_TETAP_BERWUJUD', 500),
        ('1210-002', '1210-000', 'Bangunan',                 'ASSET', 'D', true, false, 'ASET_TETAP_BERWUJUD', 501),
        ('1210-003', '1210-000', 'Kendaraan',                'ASSET', 'D', true, false, 'ASET_TETAP_BERWUJUD', 502),
        ('1210-004', '1210-000', 'Mesin & Peralatan Kantor', 'ASSET', 'D', true, false, 'ASET_TETAP_BERWUJUD', 503),
        ('1210-005', '1210-000', 'Inventaris Kantor',        'ASSET', 'D', true, false, 'ASET_TETAP_BERWUJUD', 504),
        ('1210-006', '1210-000', 'Pengembangan Lahan',       'ASSET', 'D', true, false, 'ASET_TETAP_BERWUJUD', 505);

    -- LEAF: Akumulasi Penyusutan (1220-XXX) - normal balance C
    INSERT INTO _coa_seed VALUES
        ('1220-001', '1220-000', 'Akumulasi Penyusutan Pengembangan Lahan',  'ASSET', 'C', true, false, 'ASET_TETAP_BERWUJUD', 510),
        ('1220-002', '1220-000', 'Akumulasi Penyusutan Bangunan',            'ASSET', 'C', true, false, 'ASET_TETAP_BERWUJUD', 511),
        ('1220-003', '1220-000', 'Akumulasi Penyusutan Kendaraan',           'ASSET', 'C', true, false, 'ASET_TETAP_BERWUJUD', 512),
        ('1220-004', '1220-000', 'Akumulasi Penyusutan Mesin & Peralatan',   'ASSET', 'C', true, false, 'ASET_TETAP_BERWUJUD', 513),
        ('1220-005', '1220-000', 'Akumulasi Penyusutan Inventaris',          'ASSET', 'C', true, false, 'ASET_TETAP_BERWUJUD', 514);

    -- LEAF: Aset Tetap Tidak Berwujud (1230-XXX)
    INSERT INTO _coa_seed VALUES
        ('1230-001', '1230-000', 'Software',                            'ASSET', 'D', true, false, 'ASET_TETAP_TIDAK_BERWUJUD', 520),
        ('1230-002', '1230-000', 'Perizinan dan Hak Guna/Pakai Usaha',  'ASSET', 'D', true, false, 'ASET_TETAP_TIDAK_BERWUJUD', 521);

    -- LEAF: Akumulasi Amortisasi (1240-XXX)
    INSERT INTO _coa_seed VALUES
        ('1240-001', '1240-000', 'Akumulasi Amortisasi Software',                          'ASSET', 'C', true, false, 'ASET_TETAP_TIDAK_BERWUJUD', 530),
        ('1240-002', '1240-000', 'Akumulasi Amortisasi Perizinan dan Hak Guna/Pakai Usaha','ASSET', 'C', true, false, 'ASET_TETAP_TIDAK_BERWUJUD', 531);

    -- LEAF: Aset Jangka Panjang Lainnya
    INSERT INTO _coa_seed VALUES
        ('1310-001', '1310-000', 'Investasi Jangka Panjang', 'ASSET', 'D', true, false, 'ASET_LAIN', 540);

    -- =========================================================================
    -- LEAF: Utang Usaha
    -- =========================================================================
    INSERT INTO _coa_seed VALUES
        ('2110-001', '2110-000', 'Utang Usaha', 'LIABILITY', 'C', true, false, 'UTANG_USAHA', 600);

    -- LEAF: Utang Pajak
    INSERT INTO _coa_seed VALUES
        ('2120-001', '2120-000', 'Utang Pajak PPH 29',  'LIABILITY', 'C', true, false, 'UTANG_PAJAK', 610),
        ('2120-002', '2120-000', 'PPH 21 Yang Dipotong','LIABILITY', 'C', true, false, 'UTANG_PAJAK', 611),
        ('2120-003', '2120-000', 'PPH 22 Yang Dipotong','LIABILITY', 'C', true, false, 'UTANG_PAJAK', 612),
        ('2120-004', '2120-000', 'PPH 23 Yang Dipotong','LIABILITY', 'C', true, false, 'UTANG_PAJAK', 613),
        ('2120-005', '2120-000', 'Utang PPN',           'LIABILITY', 'C', true, false, 'UTANG_PAJAK', 614),
        ('2120-006', '2120-000', 'PPN Keluaran',        'LIABILITY', 'C', true, false, 'UTANG_PAJAK', 615);

    -- LEAF: Kewajiban Lancar Lainnya
    INSERT INTO _coa_seed VALUES
        ('2130-001', '2130-000', 'Pendapatan Diterima Dimuka',   'LIABILITY', 'C', true, false, 'UTANG_LAINNYA', 620),
        ('2130-002', '2130-000', 'Uang Muka Pelanggan',          'LIABILITY', 'C', true, false, 'UTANG_LAINNYA', 621),
        ('2130-003', '2130-000', 'Biaya Yang Masih Harus Dibayar','LIABILITY','C', true, false, 'UTANG_LAINNYA', 622);

    -- LEAF: Kewajiban Jangka Panjang
    INSERT INTO _coa_seed VALUES
        ('2200-001', '2200-000', 'Utang Bank',       'LIABILITY', 'C', true, false, 'HUTANG_JANGKA_PANJANG', 630),
        ('2200-002', '2200-000', 'Utang Afiliasi',   'LIABILITY', 'C', true, false, 'HUTANG_JANGKA_PANJANG', 631),
        ('2200-003', '2200-000', 'Utang Lain-lain',  'LIABILITY', 'C', true, false, 'HUTANG_JANGKA_PANJANG', 632);

    -- =========================================================================
    -- LEAF: Modal Usaha (3110-XXX)
    -- =========================================================================
    INSERT INTO _coa_seed VALUES
        ('3110-001', '3110-000', 'Modal',                  'EQUITY', 'C', true, false, 'EKUITAS', 700),
        ('3110-002', '3110-000', 'Modal Saham',            'EQUITY', 'C', true, false, 'EKUITAS', 701),
        ('3110-003', '3110-000', 'Tambahan Modal Disetor', 'EQUITY', 'C', true, false, 'EKUITAS', 702),
        ('3110-004', '3110-000', 'Simpanan Pokok',         'EQUITY', 'C', true, false, 'EKUITAS', 703),
        ('3110-005', '3110-000', 'Simpanan Wajib',         'EQUITY', 'C', true, false, 'EKUITAS', 704),
        ('3110-006', '3110-000', 'Simpanan Sukarela',      'EQUITY', 'C', true, false, 'EKUITAS', 705),
        ('3110-007', '3110-000', 'Dana Cadangan',          'EQUITY', 'C', true, false, 'EKUITAS', 706),
        ('3110-008', '3110-000', 'Hibah',                  'EQUITY', 'C', true, false, 'EKUITAS', 707);

    -- LEAF: Laba Ditahan (3120-XXX) — termasuk Laba Rugi Periode Berjalan
    INSERT INTO _coa_seed VALUES
        ('3120-001', '3120-000', 'Laba (Rugi) Ditahan',           'EQUITY', 'C', true, false, 'EKUITAS', 710),
        ('3120-002', '3120-000', 'Laba (Rugi) Periode Berjalan',  'EQUITY', 'C', true, true,  'EKUITAS', 711),  -- ← retained earning flag
        ('3120-003', '3120-000', 'Dividen',                       'EQUITY', 'D', true, false, 'EKUITAS', 712),
        ('3120-004', '3120-000', 'Prive',                         'EQUITY', 'D', true, false, 'EKUITAS', 713);

    -- =========================================================================
    -- LEAF: Pendapatan Usaha (4110-XXX)
    -- =========================================================================
    INSERT INTO _coa_seed VALUES
        ('4110-001', '4100-000', 'Pendapatan Jasa',              'REVENUE', 'C', true, false, 'PENDAPATAN', 800),
        ('4110-002', '4100-000', 'Penjualan Barang Dagang',      'REVENUE', 'C', true, false, 'PENDAPATAN', 801),
        ('4110-003', '4100-000', 'Retur Penjualan',              'REVENUE', 'D', true, false, 'PENDAPATAN', 802),
        ('4110-004', '4100-000', 'Diskon Penjualan',             'REVENUE', 'D', true, false, 'PENDAPATAN', 803),
        ('4110-005', '4100-000', 'Pendapatan Ekspor',            'REVENUE', 'C', true, false, 'PENDAPATAN', 804);

    -- =========================================================================
    -- LEAF: HPP (5110-XXX)
    -- =========================================================================
    INSERT INTO _coa_seed VALUES
        ('5110-001', '5100-000', 'Pembelian',              'COGS', 'D', true, false, 'HPP', 900),
        ('5110-002', '5100-000', 'Biaya Angkut Pembelian', 'COGS', 'D', true, false, 'HPP', 901),
        ('5110-003', '5100-000', 'Retur Pembelian',        'COGS', 'C', true, false, 'HPP', 902),
        ('5110-004', '5100-000', 'Diskon Pembelian',       'COGS', 'C', true, false, 'HPP', 903),
        ('5110-005', '5100-000', 'Harga Pokok Penjualan',  'COGS', 'D', true, false, 'HPP', 904);

    -- =========================================================================
    -- LEAF: Beban Penjualan Langsung (6110-XXX)
    -- =========================================================================
    INSERT INTO _coa_seed VALUES
        ('6110-001', '6110-000', 'Biaya Angkut Penjualan',           'EXPENSE', 'D', true, false, 'BIAYA_PENJUALAN', 1000),
        ('6110-002', '6110-000', 'Biaya Buruh (Bongkar Muat Stock)', 'EXPENSE', 'D', true, false, 'BIAYA_PENJUALAN', 1001),
        ('6110-003', '6110-000', 'Biaya Promosi & Sampling',         'EXPENSE', 'D', true, false, 'BIAYA_PENJUALAN', 1002),
        ('6110-004', '6110-000', 'Biaya Insentif/Komisi',            'EXPENSE', 'D', true, false, 'BIAYA_PENJUALAN', 1003),
        ('6110-005', '6110-000', 'Biaya BBM Penjualan',              'EXPENSE', 'D', true, false, 'BIAYA_PENJUALAN', 1004);

    -- LEAF: Biaya HRD (6120-XXX)
    INSERT INTO _coa_seed VALUES
        ('6120-001', '6120-000', 'Biaya Gaji, Honor, Lembur & Tunjangan Lainnya', 'EXPENSE', 'D', true, false, 'BIAYA_HRD', 1010),
        ('6120-002', '6120-000', 'Biaya THR',                                     'EXPENSE', 'D', true, false, 'BIAYA_HRD', 1011),
        ('6120-003', '6120-000', 'Biaya Bonus',                                   'EXPENSE', 'D', true, false, 'BIAYA_HRD', 1012),
        ('6120-004', '6120-000', 'Biaya Pesangon',                                'EXPENSE', 'D', true, false, 'BIAYA_HRD', 1013),
        ('6120-005', '6120-000', 'Biaya Asuransi Karyawan',                       'EXPENSE', 'D', true, false, 'BIAYA_HRD', 1014),
        ('6120-006', '6120-000', 'Biaya Training & Seminar',                      'EXPENSE', 'D', true, false, 'BIAYA_HRD', 1015),
        ('6120-007', '6120-000', 'Biaya Konsumsi Karyawan',                       'EXPENSE', 'D', true, false, 'BIAYA_HRD', 1016);

    -- LEAF: Biaya Administrasi (6130-XXX)
    INSERT INTO _coa_seed VALUES
        ('6130-001', '6130-000', 'Biaya Listrik',                          'EXPENSE', 'D', true, false, 'BIAYA_ADMIN', 1020),
        ('6130-002', '6130-000', 'Biaya Air',                              'EXPENSE', 'D', true, false, 'BIAYA_ADMIN', 1021),
        ('6130-003', '6130-000', 'Biaya Telepon dan Internet',             'EXPENSE', 'D', true, false, 'BIAYA_ADMIN', 1022),
        ('6130-004', '6130-000', 'Biaya Perlengkapan & ATK Kantor',        'EXPENSE', 'D', true, false, 'BIAYA_ADMIN', 1023),
        ('6130-005', '6130-000', 'Biaya BBM & Genset Kantor',              'EXPENSE', 'D', true, false, 'BIAYA_ADMIN', 1024),
        ('6130-006', '6130-000', 'Biaya Fotokopi & Percetakan',            'EXPENSE', 'D', true, false, 'BIAYA_ADMIN', 1025),
        ('6130-007', '6130-000', 'Biaya Entertainment & Jamuan',           'EXPENSE', 'D', true, false, 'BIAYA_ADMIN', 1026),
        ('6130-008', '6130-000', 'Biaya Asuransi Properti & Kendaraan',    'EXPENSE', 'D', true, false, 'BIAYA_ADMIN', 1027),
        ('6130-009', '6130-000', 'Biaya Jasa Profesional (Konsultan)',     'EXPENSE', 'D', true, false, 'BIAYA_ADMIN', 1028),
        ('6130-010', '6130-000', 'Biaya Perjalanan Dinas',                 'EXPENSE', 'D', true, false, 'BIAYA_ADMIN', 1029);

    -- LEAF: Biaya Pajak (6140-XXX)
    INSERT INTO _coa_seed VALUES
        ('6140-001', '6140-000', 'Biaya Pajak Bumi dan Bangunan (PBB)', 'EXPENSE', 'D', true, false, 'BIAYA_PAJAK', 1040),
        ('6140-002', '6140-000', 'Biaya Pajak Kendaraan',               'EXPENSE', 'D', true, false, 'BIAYA_PAJAK', 1041),
        ('6140-003', '6140-000', 'Biaya Pengurusan Izin',               'EXPENSE', 'D', true, false, 'BIAYA_PAJAK', 1042),
        ('6140-004', '6140-000', 'Biaya PPh Pasal 21',                  'EXPENSE', 'D', true, false, 'BIAYA_PAJAK', 1043),
        ('6140-005', '6140-000', 'Biaya PPh Pasal 25',                  'EXPENSE', 'D', true, false, 'BIAYA_PAJAK', 1044),
        ('6140-006', '6140-000', 'Biaya Sanksi Pajak',                  'EXPENSE', 'D', true, false, 'BIAYA_PAJAK', 1045);

    -- LEAF: Penyusutan & Amortisasi (6150-XXX)
    INSERT INTO _coa_seed VALUES
        ('6150-001', '6150-000', 'Biaya Penyusutan Bangunan',                       'EXPENSE', 'D', true, false, 'PENYUSUTAN', 1050),
        ('6150-002', '6150-000', 'Biaya Penyusutan Kendaraan',                      'EXPENSE', 'D', true, false, 'PENYUSUTAN', 1051),
        ('6150-003', '6150-000', 'Biaya Penyusutan Mesin & Peralatan',              'EXPENSE', 'D', true, false, 'PENYUSUTAN', 1052),
        ('6150-004', '6150-000', 'Biaya Penyusutan Inventaris',                     'EXPENSE', 'D', true, false, 'PENYUSUTAN', 1053),
        ('6150-005', '6150-000', 'Biaya Amortisasi Software',                       'EXPENSE', 'D', true, false, 'PENYUSUTAN', 1054),
        ('6150-006', '6150-000', 'Biaya Amortisasi Perizinan dan Hak Guna Usaha',   'EXPENSE', 'D', true, false, 'PENYUSUTAN', 1055);

    -- LEAF: Biaya Lainnya (6160-XXX)
    INSERT INTO _coa_seed VALUES
        ('6160-001', '6160-000', 'Biaya Sewa Aset',                  'EXPENSE', 'D', true, false, 'BIAYA_LAIN', 1060),
        ('6160-002', '6160-000', 'Biaya Pemeliharaan Bangunan',      'EXPENSE', 'D', true, false, 'BIAYA_LAIN', 1061),
        ('6160-003', '6160-000', 'Biaya Pemeliharaan Kendaraan',     'EXPENSE', 'D', true, false, 'BIAYA_LAIN', 1062),
        ('6160-004', '6160-000', 'Biaya Pemeliharaan Mesin & Peralatan','EXPENSE','D',true, false, 'BIAYA_LAIN', 1063),
        ('6160-005', '6160-000', 'Biaya Pemeliharaan Inventaris',    'EXPENSE', 'D', true, false, 'BIAYA_LAIN', 1064);

    -- LEAF: Biaya Non Operasional (6210-XXX)
    INSERT INTO _coa_seed VALUES
        ('6210-001', '6210-000', 'Biaya Selisih Kas/Bank',           'EXPENSE', 'D', true, false, 'BIAYA_NON_OP', 1100),
        ('6210-002', '6210-000', 'Biaya Piutang Tidak Tertagih',     'EXPENSE', 'D', true, false, 'BIAYA_NON_OP', 1101),
        ('6210-003', '6210-000', 'Biaya Kerugian Penghapusan Stock', 'EXPENSE', 'D', true, false, 'BIAYA_NON_OP', 1102);

    -- =========================================================================
    -- LEAF: Pendapatan di Luar Usaha (7110-XXX)
    -- =========================================================================
    INSERT INTO _coa_seed VALUES
        ('7110-001', '7100-000', 'Pendapatan Bunga Bank',              'OTHER_INCOME', 'C', true, false, 'PENDAPATAN_LAIN', 1200),
        ('7110-002', '7100-000', 'Pendapatan Sewa',                    'OTHER_INCOME', 'C', true, false, 'PENDAPATAN_LAIN', 1201),
        ('7110-003', '7100-000', 'Keuntungan Atas Penjualan Aset',     'OTHER_INCOME', 'C', true, false, 'PENDAPATAN_LAIN', 1202),
        ('7110-004', '7100-000', 'Pendapatan Komisi',                  'OTHER_INCOME', 'C', true, false, 'PENDAPATAN_LAIN', 1203),
        ('7110-005', '7100-000', 'Pendapatan Atas Klaim Asuransi',     'OTHER_INCOME', 'C', true, false, 'PENDAPATAN_LAIN', 1204),
        ('7110-006', '7100-000', 'Pendapatan Dividen',                 'OTHER_INCOME', 'C', true, false, 'PENDAPATAN_LAIN', 1205),
        ('7110-007', '7100-000', 'Keuntungan Atas Selisih Kurs',       'OTHER_INCOME', 'C', true, false, 'PENDAPATAN_LAIN', 1206),
        ('7110-008', '7100-000', 'Pendapatan Lain-lain',               'OTHER_INCOME', 'C', true, false, 'PENDAPATAN_LAIN', 1207);

    -- =========================================================================
    -- LEAF: Beban di Luar Usaha (8110-XXX)
    -- =========================================================================
    INSERT INTO _coa_seed VALUES
        ('8110-001', '8100-000', 'Pajak Bunga Bank',         'OTHER_EXPENSE', 'D', true, false, 'BEBAN_LAIN', 1300),
        ('8110-002', '8100-000', 'Beban Adm Bank & Lainnya', 'OTHER_EXPENSE', 'D', true, false, 'BEBAN_LAIN', 1301),
        ('8110-003', '8100-000', 'Rugi Atas Selisih Kurs',   'OTHER_EXPENSE', 'D', true, false, 'BEBAN_LAIN', 1302),
        ('8110-004', '8100-000', 'Rugi Penjualan Aset Tetap','OTHER_EXPENSE', 'D', true, false, 'BEBAN_LAIN', 1303),
        ('8110-005', '8100-000', 'Pengeluaran Lain-lain',    'OTHER_EXPENSE', 'D', true, false, 'BEBAN_LAIN', 1304);

    -- =========================================================================
    -- LEAF: Beban Pajak Penghasilan (9110-XXX)
    -- =========================================================================
    INSERT INTO _coa_seed VALUES
        ('9110-001', '9100-000', 'Beban Pajak Penghasilan', 'TAX_EXPENSE', 'D', true, false, 'PAJAK', 1400);

    -- =========================================================================
    -- INSERT BERTAHAP berdasarkan ordering (parent dulu, baru child)
    -- =========================================================================
    FOR v_coa IN SELECT * FROM _coa_seed ORDER BY ordering LOOP
        -- resolve parent_id berdasarkan parent_code (per company)
        v_parent_id := NULL;
        IF v_coa.parent_code IS NOT NULL THEN
            SELECT id INTO v_parent_id
              FROM accounts
             WHERE company_id = p_company_id
               AND code = v_coa.parent_code;
        END IF;

        INSERT INTO accounts (
            company_id, parent_id, code, name,
            category, sub_category, normal_balance,
            is_postable, is_retained_earning
        ) VALUES (
            p_company_id, v_parent_id, v_coa.code, v_coa.name,
            v_coa.category, v_coa.sub_category, v_coa.normal_balance,
            v_coa.is_postable, v_coa.is_retained_earning
        )
        ON CONFLICT (company_id, code) DO NOTHING;

        IF FOUND THEN
            v_inserted_count := v_inserted_count + 1;
        END IF;
    END LOOP;

    RETURN v_inserted_count;
END $$;

COMMENT ON FUNCTION seed_default_coa IS
    'Idempotent seed COA default Indonesia untuk company baru. Return jumlah row baru.';

-- =============================================================================
-- HELPER: bootstrap accounting period 12 bulan untuk tahun tertentu
-- =============================================================================
CREATE OR REPLACE FUNCTION bootstrap_accounting_periods(p_company_id BIGINT, p_year SMALLINT)
    RETURNS INT
    LANGUAGE plpgsql
AS $$
DECLARE
    v_month  SMALLINT;
    v_count  INT := 0;
BEGIN
    FOR v_month IN 1..12 LOOP
        INSERT INTO accounting_periods (company_id, year, month, status)
        VALUES (p_company_id, p_year, v_month, 'open')
        ON CONFLICT (company_id, year, month) DO NOTHING;

        IF FOUND THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;
    RETURN v_count;
END $$;
