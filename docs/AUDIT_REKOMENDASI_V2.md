# Audit Eccounting v1 & Rekomendasi Rebuild v2

> Dokumen ini adalah hasil audit codebase Eccounting versi sekarang (Laravel 5.5 / PHP 7 / MySQL 5.7 / Voyager / Maatwebsite/Excel 2.1) sekaligus rekomendasi arsitektur untuk versi baru.
>
> Konteks domain: aplikasi pembukuan yang digunakan oleh **konsultan pajak** untuk mengelola **banyak pembukuan klien** (multi-company accounting). Tenant = perusahaan klien yang pembukuannya dikelola konsultan.

---

## 1. Ringkasan Eksekutif

Dua keluhan utama dari pengguna:

1. **Data sering tidak konsisten** ketika upload jurnal & proses laporan.
2. **Server sering down** pada penggunaan berat.

Hasil audit menunjukkan kedua masalah ini **bukan disebabkan oleh framework** (Laravel/PHP/MySQL), melainkan oleh sejumlah **kesalahan desain fundamental** yang akan tetap ada jika hanya di-upgrade. Karena itu rekomendasi saya adalah **rewrite v2** dengan stack modern + memperbaiki kesalahan desain ini di akar.

### Akar masalah ringkas

| Gejala yang dilaporkan user | Akar masalah teknis |
|---|---|
| Data jurnal hilang sebagian setelah posting | Tidak ada `DB::transaction()` di posting jurnal. Operasi multi-step `insert/delete` tanpa rollback. |
| Neraca tidak balance | `CashController` hanya buat 1 sisi entry (melanggar double-entry). Validasi balance hanya di PHP, bisa di-bypass. |
| Saldo akun salah | Saldo dihitung ulang dari awal setiap render laporan, dengan subquery `SELECT *` raw. Salah index = salah hasil. |
| Posting ID duplikat | `max(count)+1` di PHP, tidak atomic. Race condition saat 2 user posting bersamaan. |
| Server 502 / hang | Hard-delete loop dengan `sleep(2)` di HTTP request; import Excel in-memory; queue masih `sync`. |
| Data klien lain bocor | Multi-tenant berbasis `session('client')->id` di PHP, tidak ditegakkan di DB. Kalau lupa `where client_id` = leak. |
| Edit jurnal merusak audit | `Journal::update`/`delete` bebas; tidak ada konsep posting immutability / period close. |

---

## 2. Audit Detail Codebase v1

### 2.1 Stack saat ini (semua end-of-life)

| Komponen | Versi | Status |
|---|---|---|
| PHP | 7.0/7.1 (Dockerfile) | EOL Jan 2019 |
| Laravel | 5.5 | EOL Aug 2020, no security patch |
| MySQL | 5.7 | EOL Oct 2023 |
| Voyager | 1.1 | tidak terawat |
| Maatwebsite/Excel | 2.1 (pakai PHPExcel) | versi sekarang 3.x, PHPExcel mati 2017 |
| franzose/closure-table | 5.1 | tidak terawat |
| Vue.js | 2.5 | EOL Dec 2023 |
| Bootstrap | 3.3 | EOL Jul 2019 |
| jQuery | 3.2 | sangat lama |
| Laravel Mix | 1.0 + Webpack 2 | legacy |

### 2.2 Bug arsitektur & data integrity

#### B-01 ─ Tidak ada DB Transaction di posting jurnal *(CRITICAL)*

`JournalController::store` melakukan urutan: `GroupJournal::create` → `Journal::delete` → `Journal::insert` → `TempJournal::delete`. **Tanpa transaction**. Jika satu langkah gagal, sisanya tetap commit → data inkonsisten permanen.

```43:115:app/Http/Controllers/JournalController.php
        $group_journal = GroupJournal::create([...]);
        ...
        Journal::where('group_journal_id',$group_journal_id)->delete();
        ...
        Journal::insert($temp_journals);
        ...
        TempJournal::where('user_id',$user_id)->where('client_id',$client->id)->delete();
```

Hal yang sama terjadi di `JournalController::update`, `JournalController::destroy`, `CashController::store`, `GroupJournalController::importFile`, dan `ClientController::createClientCoa` (puluhan/ratusan insert berturut-turut).

#### B-02 ─ Double-entry dilanggar oleh CashController *(CRITICAL)*

```108:116:app/Http/Controllers/CashController.php
        $journal = Journal::create([
            'group_journal_id'    => $group_journal->id,
            'coa_id'              => $coa_id,
            'desc'                => $note.' [cash '.$type.']',
            ...
            'debet'               => $debet,
            'credit'              => $credit,
            'reference'           => $cash->id
        ]);
```

Hanya **1 baris journal**. Setiap transaksi cash menambah debit ATAU credit tanpa pasangannya → group_journal selalu tidak balance → neraca pasti melenceng begitu cash in/out dipakai.

#### B-03 ─ Multi-tenant lewat `session('client')->id` saja *(CRITICAL)*

Tidak ada global scope, tidak ada RLS, tidak ada constraint DB. Tenant isolation 100% tergantung programmer ingat `where client_id`. Sekali lupa = data tenant lain bocor / tertimpa.

Contoh masalah real di codebase:

```108:109:app/Http/Controllers/BalanceController.php
        $subquery = "(SELECT journal.* FROM journal WHERE
                      journal.transaction_date <= '$this->this_month_last_day') as journal";
```

Subquery ini **tidak memfilter `client_id`** — full scan lintas tenant. Kalaupun outer query memfilter `coa.client_id`, ada potensi performa buruk dan risiko bocor jika struktur join berubah.

```19:20:database/migrations/2018_05_27_081125_create_coa_table.php
            $table->string('code')->unique();
```

`coa.code` UNIQUE **global**. Artinya kalau Client A pakai kode "1100-001", Client B tidak boleh pakai kode itu. Bug konseptual.

#### B-04 ─ TempJournal sebagai shared staging table di DB *(HIGH)*

`temp_journal` di-share oleh semua user/client, dengan logic state via `session('group_journal_id')`. Ditambah middleware yang **menghapus** data temp user lain dalam keadaan tertentu:

```28:32:app/Http/Middleware/CheckTempJournalExistMiddleware.php
        if($check_temp_journals!=0){
            TempJournal::where('user_id',$user_id)
                        ->where('client_id',$client_id)
                        ->delete();
        }
```

User buka 2 tab → tab kedua bisa menghapus draft tab pertama. Ini sumber laporan "data yang saya input hilang".

#### B-05 ─ Tidak ada constraint balanced double-entry di DB *(HIGH)*

Validasi `check_balance()` hanya di application layer. Bisa di-bypass dengan API call langsung, bug controller, atau script migrasi. Akuntansi mewajibkan ini di DB level (trigger / deferred constraint).

#### B-06 ─ Posting ID generator tidak atomic *(HIGH)*

```11:24:app/Http/Controllers/PostingIdController.php
    public function generate()
    {
        $client = session('client');
        $prefix = "JU".date("Ym");
        $posting_id_row = GroupJournal::where('id_show','like',$prefix.'%')
                                        ->where('client_id',$client->id)
                                        ->count();
        $posting_id_now = $posting_id_row + 1;
        ...
```

Pola `count + 1` tanpa lock. Dua user posting bersamaan = posting ID duplikat. Tidak terdeteksi karena `id_show` **tidak UNIQUE** di DB.

#### B-07 ─ Journal mutable (UPDATE/DELETE bebas) *(HIGH)*

Standar akuntansi: journal entry harus **immutable**. Koreksi = reversal + entry baru. Codebase saat ini bebas update/delete sehingga audit trail (laravel-auditing) bisa berbeda dari realita.

#### B-08 ─ Hard delete loop di HTTP request *(CRITICAL untuk uptime)*

```316:319:app/Http/Controllers/JournalController.php
        do {
            $deleted = Journal::where('group_journal_id', $group_journal->id)->limit(1000)->delete();
            sleep(2);
        }while($deleted > 0);
```

Delete 100k row = HTTP request menahan worker PHP-FPM ~200 detik. Beberapa user hapus bersamaan = pool worker habis = **502 / server down**. Solusi seharusnya: queued soft-delete + background hard-delete.

#### B-09 ─ Import Excel sinkron, in-memory, satu request HTTP *(CRITICAL untuk uptime)*

```91:91:app/Http/Controllers/GroupJournalController.php
                $data = \Excel::load( $file_journals )->get();
```

Maatwebsite 2.1 + PHPExcel memuat seluruh workbook ke memory. File 30 MB = >1 GB RAM. Timeout/OOM → worker mati. `.env.example` punya `QUEUE_DRIVER=sync` → tidak ada background processing sama sekali.

#### B-10 ─ Decimal precision bermasalah historis *(HIGH)*

Migration `2018_08_22_145929_alter_journal_table_add_decimal_length` mengubah `decimal()` (default 8,2) menjadi `decimal(19,2)`. Artinya **pernah** ada masalah overflow / pemotongan angka. Untuk uang, minimum `DECIMAL(20,4)`.

#### B-11 ─ Closure table untuk COA via paket tidak terawat *(MEDIUM)*

`franzose/closure-table` 5.1 — pendekatan benar untuk hierarki COA, tapi paket sudah lama tidak update. Banyak operasi rekursif PHP yang memuat seluruh tree ke memory (`getCoaTreeAndSeq`, `createCoaTree`, `createCoaSelectBoxOptions`). Tidak scalable kalau COA per klien banyak.

#### B-12 ─ Tidak ada period close *(HIGH)*

Tidak ada konsep "periode sudah ditutup". Konsultan pajak setelah lapor SPT bulanan TIDAK boleh ada perubahan ke periode itu. Saat ini tidak ada enforcement → data historis bisa di-edit kapan saja.

#### B-13 ─ Laporan recompute dari nol setiap kali *(HIGH)*

`BalanceSheetController::queryBalanceSheet` & `BalanceController::queryBalance` selalu menjumlahkan ulang seluruh history journal. Tanpa snapshot/materialized balance. Setelah journal sampai jutaan baris = laporan lambat & query mahal.

#### B-14 ─ Code rot & debug code di production *(MEDIUM)*

```96:97:app/Http/Controllers/LedgerController.php
        print_r($journals);
        exit();
```

Plus filter hardcoded `'PINJAMAN PRIBADI AN JOKO JAGA MALAM DI PROYEK GLOW DE PARIS'` di query laporan (line 92). Tanda pengembangan ad-hoc tanpa code review.

#### B-15 ─ Schema "tambal sulam" *(MEDIUM)*

- `journal` migration awal **tidak punya** `group_journal_id` (ditambah belakangan).
- `temp_journal` migration awal **tidak punya** `client_id` & `group_journal_id` (ditambah belakangan).
- `journal` tabel masih simpan `client_id` & `batch_import_id` (redundan dengan `group_journal`).
- Banyak alter table untuk seed/struktur → sulit di-rebuild from scratch.

#### B-16 ─ Audit log di DB terpisah, tapi bukan immutable *(MEDIUM)*

`owen-it/laravel-auditing` simpan log di `DB_AUDITING_*` (DB kedua) — bagus secara konsep. Tapi:
- Tabel audit masih bisa di-UPDATE/DELETE (tidak WORM).
- Tidak ada hash chain / signature → audit bisa dimanipulasi DBA.
- Tidak memenuhi standar PSAK / audit kantor pajak yang serius.

### 2.3 Operasional & DevOps

- Queue `sync`, cache `file`, session `file` → tidak siap multi-instance.
- Tidak ada health check, log aggregation, metrics, alerting.
- Tidak ada CI/CD config terlihat.
- `hiubanhin.sql` 38 MB (dump produksi?) **commit ke Git** → risiko keamanan tinggi.
- Tidak ada strategi backup / PITR terdokumentasi.
- Container DB tanpa volume persistence eksplisit.

---

## 3. Prinsip Wajib Aplikasi Akuntansi (apapun stack-nya)

Ini standar **non-negotiable** untuk v2. Semua poin di bawah harus terpenuhi sebelum go-live.

1. **Append-only ledger.** Tabel `journal_entries` & `journal_lines` tidak boleh di-UPDATE/DELETE oleh siapa pun (revoke via DB role + trigger). Koreksi = entry baru dengan `reversal_of_id`.
2. **Double-entry dipaksakan di DB.** Trigger / constraint memastikan `SUM(debit) = SUM(credit)` per `journal_entry_id`. Kombinasi `(debit_amount XOR credit_amount)` per line.
3. **DECIMAL(20,4)** untuk semua kolom moneter. Tidak pernah float.
4. **Transaction ACID** wajib di setiap operasi multi-step. Isolation minimal `REPEATABLE READ` (PostgreSQL default).
5. **Multi-company isolation di DB level**, bukan di application layer. Pilihan:
   - PostgreSQL **Row-Level Security** dengan `SET LOCAL app.company_id` per koneksi (rekomendasi).
   - Schema-per-company (alternatif, isolasi lebih kuat tapi operasional lebih berat).
6. **Posting number atomic** lewat PostgreSQL sequence per company atau advisory lock.
7. **Period close**: tabel `accounting_periods (status: open|closed|locked)`. Trigger menolak insert/update ke periode `closed`.
8. **Idempotent import** dengan `(company_id, file_sha256)` unique. Replay aman.
9. **Background processing**: import Excel, generate laporan besar, hard-delete batch → semua via queue worker.
10. **Materialized balances**: tabel `account_period_balance (company_id, account_id, period, opening, debit, credit, closing)`. Laporan jadi `SELECT` murah, bukan rekalkulasi.
11. **Audit log immutable** (append-only, hash chained jika perlu kepatuhan).
12. **Backup harian + PITR**. RPO ≤ 15 menit, RTO ≤ 1 jam. Restore drill rutin.

---

## 4. Rekomendasi Tech Stack v2

### 4.1 Pilihan utama yang direkomendasikan

Untuk profil **konsultan pajak Indonesia mengelola banyak pembukuan klien**, dua stack yang paling masuk akal:

#### **Pilihan A — Laravel 11 + PostgreSQL + Filament + Inertia** ⭐ rekomendasi default

| Layer | Pilihan |
|---|---|
| Runtime | PHP 8.3 |
| Framework | Laravel 11 LTS |
| Database | **PostgreSQL 16** (RLS, NUMERIC, deferred constraint, partial index) |
| Cache & Queue | Redis + Laravel Horizon |
| Admin / internal tools | **Filament 3** (pengganti Voyager, jauh lebih modern) |
| Frontend app utama | Inertia.js + React (atau Vue 3) + Tailwind + shadcn/ui |
| Spreadsheet engine | `maatwebsite/excel` 3.x dengan `WithChunkReading` + `ShouldQueue` + `WithBatchInserts` |
| Multi-company | PostgreSQL RLS + Laravel scope global yang mengeset `app.company_id` per request |
| Permission | `spatie/laravel-permission` |
| Audit | `owen-it/laravel-auditing` 13.x ke DB terpisah + tabel append-only |
| Reporting | PostgreSQL materialized view + scheduled refresh |
| Static analysis | PHPStan / Larastan level 8 |
| Testing | Pest |
| CI/CD | GitHub Actions, Docker (PHP 8.3-fpm-alpine + Nginx) |
| Observability | Sentry + JSON log → Loki/Grafana |

**Kelebihan untuk konteks ini:**
- Ekosistem akuntansi/CRUD di Laravel sangat kaya. Filament generate UI untuk laporan, COA, jurnal cepat sekali.
- Tim sebelumnya sudah Laravel → kurva belajar rendah, fokus bisa ke perbaikan desain.
- PostgreSQL RLS menyelesaikan masalah multi-company dengan tegas.
- Horizon untuk queue + monitoring = mudah debugging.

**Kekurangan:**
- Frontend tetap server-rendered (Inertia) — kalau butuh mobile/PWA, perlu tambah layer API.

#### **Pilihan B — Next.js + NestJS + Drizzle + PostgreSQL**

| Layer | Pilihan |
|---|---|
| Backend API | NestJS (modular, opinionated) |
| ORM | Drizzle (SQL-first, type-safe) |
| Database | PostgreSQL 16 + RLS |
| Queue | BullMQ + Redis |
| Frontend | Next.js 14 (App Router) + React + Tailwind + shadcn/ui + TanStack Table & Query |
| Auth | Auth.js / Better-Auth |
| Excel | ExcelJS streaming di worker (Node) |
| Observability | Sentry + OpenTelemetry |
| CI/CD | GitHub Actions, Docker (Node 22 alpine) |

**Kelebihan:**
- Type safety end-to-end (TypeScript). Untuk akuntansi yang butuh presisi, ini bantu sekali.
- DX modern, frontend kelas SaaS bisa dibangun cepat dengan shadcn + TanStack Table.
- Mudah split jadi mobile app / public API ke depannya.

**Kekurangan:**
- Tim harus shifting bahasa dari PHP ke TS.
- Lebih banyak boilerplate untuk admin panel (tidak ada Filament setara).
- Lebih banyak moving parts (terutama state management, validation di 2 layer).

### 4.2 Pilihan database — **wajib pindah ke PostgreSQL**

Apapun bahasa yang dipilih, **rekomendasi tegas**: ganti MySQL → **PostgreSQL 16**. Alasan untuk akuntansi:

- **Row-Level Security (RLS)** native → multi-company isolation di level DB.
- **NUMERIC** presisi arbitrer (vs MySQL DECIMAL maksimum 65 digit).
- **Deferred constraints** → bisa validasi balanced double-entry di akhir transaction.
- **CTE & window functions** matang → laporan running balance jauh lebih clean.
- **Partial index** → index hanya untuk `status='open'`, dst.
- **MVCC** tanpa lock berlebihan → konkurensi posting jauh lebih baik dari InnoDB.
- **Logical replication** & **PITR** matang.
- **Materialized view** built-in.

### 4.3 Stack frontend & UI

Apapun backend:

- **Tailwind CSS** + **shadcn/ui** (React) atau **shadcn-vue** untuk komponen.
- **TanStack Table v8** untuk grid jurnal/laporan (virtualization wajib untuk 100rb+ row).
- **TanStack Query** / SWR untuk state cache.
- **Zod** (TS) / **FormRequest** + array validation (Laravel) untuk validasi end-to-end.
- Komponen-komponen yang harus modular & reusable (sesuai user rule SOLID):
  - `<JournalEntryForm>` (debit/credit lines)
  - `<CoaTreeSelect>`
  - `<PeriodPicker>`
  - `<FinancialReportTable>` (generic untuk neraca, laba rugi, buku besar)
  - `<ImportExcelDialog>` (queue + progress polling)

### 4.4 Tidak direkomendasikan untuk kebutuhan ini

- **Pure JS web frontend tanpa SSR** (CRA, Vite SPA tanpa server) → SEO/auth complexity tidak perlu.
- **MongoDB / NoSQL** untuk ledger → akuntansi adalah relasional dan butuh ACID kuat.
- **Voyager / TCG admin** lagi → mati ekosistemnya.
- **PHP < 8.3, Laravel < 11**, MySQL untuk v2 → tidak menyelesaikan akar masalah.

### 4.5 Opsional untuk skala besar

Kalau aplikasi akan jadi produk SaaS multi-firma dengan ratusan ribu klien:

- **TigerBeetle** untuk core ledger engine (database open-source khusus double-entry, throughput jutaan tx/detik, built-in safety).
- **ClickHouse / DuckDB** untuk reporting/DWH terpisah.
- **Kafka** untuk event bus posting jurnal.

Tapi untuk konsultan pajak Indonesia dengan puluhan-ratusan klien, **PostgreSQL + Laravel/Next.js sudah lebih dari cukup**.

---

## 5. Domain Model v2 (Usulan)

### 5.1 Konsep utama

```
Firm (kantor konsultan)
 └─ Members (User di firm dengan role)
 └─ Companies (klien yg pembukuannya dikelola — INI tenant utama)
      ├─ ChartOfAccount (COA per company, hierarchical)
      ├─ AccountingPeriods (open/closed/locked)
      ├─ JournalEntries (header — append-only)
      │    └─ JournalLines (debit/credit lines)
      ├─ AccountPeriodBalance (materialized snapshot saldo)
      ├─ ImportBatches (idempotent oleh file hash)
      └─ AuditLog (append-only, hash-chained)
```

### 5.2 Skema PostgreSQL inti (sketsa)

```sql
-- Firm = kantor konsultan
CREATE TABLE firms (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users milik firm
CREATE TABLE users (
  id           BIGSERIAL PRIMARY KEY,
  firm_id      BIGINT NOT NULL REFERENCES firms(id),
  email        CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name         TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Company = klien yg pembukuannya dikelola (TENANT UTAMA)
CREATE TABLE companies (
  id           BIGSERIAL PRIMARY KEY,
  firm_id      BIGINT NOT NULL REFERENCES firms(id),
  name         TEXT NOT NULL,
  npwp         VARCHAR(20),
  base_currency CHAR(3) NOT NULL DEFAULT 'IDR',
  fiscal_year_start_month SMALLINT NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at  TIMESTAMPTZ
);

CREATE TABLE company_members (
  company_id   BIGINT NOT NULL REFERENCES companies(id),
  user_id      BIGINT NOT NULL REFERENCES users(id),
  role         TEXT NOT NULL, -- owner|accountant|viewer
  PRIMARY KEY (company_id, user_id)
);

-- Chart of Accounts per company
CREATE TABLE accounts (
  id           BIGSERIAL PRIMARY KEY,
  company_id   BIGINT NOT NULL REFERENCES companies(id),
  parent_id    BIGINT REFERENCES accounts(id),
  code         VARCHAR(32) NOT NULL,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL, -- ASSET|LIABILITY|EQUITY|REVENUE|EXPENSE
  normal_balance CHAR(1) NOT NULL CHECK (normal_balance IN ('D','C')),
  is_postable  BOOLEAN NOT NULL DEFAULT true, -- daun = postable
  path         LTREE, -- untuk hierarchical query cepat
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at  TIMESTAMPTZ,
  UNIQUE (company_id, code)  -- ← per company, bukan global
);

CREATE INDEX accounts_company_path ON accounts USING GIST (company_id, path);

-- Period close
CREATE TABLE accounting_periods (
  id           BIGSERIAL PRIMARY KEY,
  company_id   BIGINT NOT NULL REFERENCES companies(id),
  year         SMALLINT NOT NULL,
  month        SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','locked')),
  closed_at    TIMESTAMPTZ,
  closed_by    BIGINT REFERENCES users(id),
  UNIQUE (company_id, year, month)
);

-- Header jurnal
CREATE TABLE journal_entries (
  id             BIGSERIAL PRIMARY KEY,
  company_id     BIGINT NOT NULL REFERENCES companies(id),
  posting_number TEXT NOT NULL,
  posting_date   DATE NOT NULL,
  transaction_date DATE NOT NULL,
  description    TEXT,
  source         TEXT NOT NULL, -- manual|import|cash|reversal
  reversal_of_id BIGINT REFERENCES journal_entries(id),
  import_batch_id BIGINT REFERENCES import_batches(id),
  created_by     BIGINT NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, posting_number)
);

CREATE INDEX je_company_period ON journal_entries (company_id, posting_date);

-- Line jurnal (append-only)
CREATE TABLE journal_lines (
  id              BIGSERIAL PRIMARY KEY,
  journal_entry_id BIGINT NOT NULL REFERENCES journal_entries(id),
  company_id      BIGINT NOT NULL, -- denormalized for RLS performance
  account_id      BIGINT NOT NULL REFERENCES accounts(id),
  line_no         SMALLINT NOT NULL,
  debit           NUMERIC(20,4) NOT NULL DEFAULT 0 CHECK (debit  >= 0),
  credit          NUMERIC(20,4) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  reference       TEXT,
  description     TEXT,
  CHECK ( (debit = 0) <> (credit = 0) ),  -- exactly one side
  UNIQUE (journal_entry_id, line_no)
);

CREATE INDEX jl_account_date ON journal_lines (company_id, account_id);

-- Trigger: balanced double-entry
CREATE OR REPLACE FUNCTION trg_je_must_balance() RETURNS TRIGGER AS $$
DECLARE
  total_debit  NUMERIC(20,4);
  total_credit NUMERIC(20,4);
BEGIN
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
    INTO total_debit, total_credit
    FROM journal_lines WHERE journal_entry_id = NEW.id;
  IF total_debit <> total_credit OR total_debit = 0 THEN
    RAISE EXCEPTION 'Journal entry % not balanced (D=%, C=%)',
      NEW.id, total_debit, total_credit;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER je_balance_check
  AFTER INSERT OR UPDATE ON journal_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION trg_je_must_balance();

-- Trigger: tolak posting ke periode tertutup
CREATE OR REPLACE FUNCTION trg_je_period_open() RETURNS TRIGGER AS $$
DECLARE st TEXT;
BEGIN
  SELECT status INTO st FROM accounting_periods
    WHERE company_id = NEW.company_id
      AND year = EXTRACT(YEAR FROM NEW.posting_date)
      AND month = EXTRACT(MONTH FROM NEW.posting_date);
  IF st IS NULL THEN
    RAISE EXCEPTION 'Period belum dibuka untuk %', NEW.posting_date;
  END IF;
  IF st <> 'open' THEN
    RAISE EXCEPTION 'Period % sudah %', NEW.posting_date, st;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER je_period_check
  BEFORE INSERT ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION trg_je_period_open();

-- Append-only: revoke UPDATE/DELETE
REVOKE UPDATE, DELETE ON journal_entries, journal_lines FROM app_user;

-- Materialized periodic balance
CREATE TABLE account_period_balance (
  company_id   BIGINT NOT NULL,
  account_id   BIGINT NOT NULL,
  year         SMALLINT NOT NULL,
  month        SMALLINT NOT NULL,
  opening      NUMERIC(20,4) NOT NULL DEFAULT 0,
  debit_total  NUMERIC(20,4) NOT NULL DEFAULT 0,
  credit_total NUMERIC(20,4) NOT NULL DEFAULT 0,
  closing      NUMERIC(20,4) NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, account_id, year, month)
);

-- Import batch (idempotent)
CREATE TABLE import_batches (
  id            BIGSERIAL PRIMARY KEY,
  company_id    BIGINT NOT NULL REFERENCES companies(id),
  file_name     TEXT NOT NULL,
  file_sha256   CHAR(64) NOT NULL,
  total_rows    INT,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending|processing|done|failed
  error_message TEXT,
  created_by    BIGINT NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, file_sha256)
);

-- Posting number sequence per company per bulan (atomic)
CREATE TABLE posting_number_counters (
  company_id BIGINT NOT NULL,
  yyyymm     CHAR(6) NOT NULL,
  last_value INT NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, yyyymm)
);
-- Naikkan via: UPDATE ... RETURNING last_value+1 dalam transaction
```

### 5.3 Multi-company isolation dengan RLS

```sql
ALTER TABLE accounts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
-- dst.

CREATE POLICY accounts_tenant ON accounts
  USING (company_id = current_setting('app.company_id')::bigint);

CREATE POLICY je_tenant ON journal_entries
  USING (company_id = current_setting('app.company_id')::bigint);
-- dst.
```

Di Laravel: middleware mengeset `SELECT set_config('app.company_id', ?, true)` di tiap request.  
Di NestJS: interceptor di setiap connection acquire.

Hasilnya: **kalau programmer lupa `where company_id`, query tetap aman** — DB yang menolak.

---

## 6. Rencana Migrasi v1 → v2

### 6.1 Strategi besar: **paralel, bukan in-place**

Upgrade Laravel 5.5 → 11 = belasan breaking change major + Voyager → Filament + Excel 2.1 → 3.x + Bootstrap → Tailwind. **Lebih cepat & lebih aman rewrite di repo baru**.

```
[ Eccounting v1 PROD ]  ─────►  freeze fitur, hanya patch kritikal
                                        │
[ Eccounting v2 DEV  ]  ─────►  bangun paralel, dengan tenant pilot
                                        │
                            ┌── cutover bertahap per klien ──┐
                            ▼                                ▼
                  [ v1 hapus pelan-pelan ]      [ v2 PROD all clients ]
```

### 6.2 Fase pengerjaan (estimasi)

| Fase | Output | Estimasi |
|---|---|---|
| **F0 – Persiapan** | Repo v2, skema PostgreSQL final, ERD, CI/CD dasar | 1–2 minggu |
| **F1 – Core ledger** | Auth, firm/company/user, COA, period close, journal entry (manual), audit | 3–4 minggu |
| **F2 – Import & cash** | Import Excel queued, cash in/out double-entry, batch management | 2 minggu |
| **F3 – Laporan** | Buku besar, neraca saldo, neraca, laba rugi, materialized balance + scheduled refresh | 3 minggu |
| **F4 – Migrasi data** | ETL script per klien, reconciliation harian, validasi balance | 2 minggu |
| **F5 – Pilot** | 1–2 klien pilot di v2, run paralel | 2–3 minggu |
| **F6 – Cutover** | Migrasi semua klien bertahap, monitor, dekomisi v1 | 2 minggu |

Total realistis: **3–4 bulan** dengan 2–3 developer full-time.

### 6.3 Migrasi data — mapping v1 ke v2

| v1 (MySQL) | v2 (PostgreSQL) | Catatan |
|---|---|---|
| `client` | `companies` | + isi `firm_id` (1 firm utama dulu) |
| `coa` | `accounts` | code menjadi `(company_id, code)` unique |
| `group_journal` | `journal_entries` | `id_show` → `posting_number`, validasi balance per group sebelum migrate |
| `journal` | `journal_lines` | satu row v1 → satu line v2 (sudah debit XOR credit) |
| `temp_journal` | (dihapus, jadi state client-side) | tidak ada equivalent |
| `cash` | (di-rebuild jadi journal_entries dengan 2 lines double-entry) | ⚠️ data lama mungkin tidak balance — perlu audit manual |
| `audits` | tetap di DB audit terpisah, append-only | format diadaptasi |
| `balance_sheet*` | `report_templates` (template laporan custom) | simplify |

**Wajib:** sebelum cutover, reconciliation per klien:
- Total debit per akun per periode (v1 vs v2) harus identik.
- Saldo akhir setiap akun harus identik.
- Tidak ada group_journal v1 yang tidak balance (kalau ada, perbaiki dulu di v1 atau buat journal koreksi di v2).

### 6.4 Migrasi UI

- v1 menggunakan Voyager admin + jQuery. v2 pakai Filament (admin internal) + Inertia React (app utama untuk konsultan).
- Reuse: hanya konsep & terminologi. Code frontend tulis ulang total (Tailwind + shadcn).

---

## 7. Quick Wins di v1 (sambil v2 dibangun)

Kalau v1 masih harus jalan beberapa bulan, ini perbaikan minimum agar tidak makin parah:

1. **Bungkus `JournalController::store`, `update`, `destroy`, `importFile`, `CashController::store` dengan `DB::transaction()`**. Ini bisa langsung mengurangi 80% kasus "data inkonsisten".
2. **Pindahkan `JournalController::destroy` hard-delete loop ke queue job** (Laravel queue + Redis). Endpoint cukup mark `pending_delete` & return cepat.
3. **Fix `CashController` agar buat 2 sisi journal** (debit kas + credit lawan akun, atau sebaliknya).
4. **Ganti `QUEUE_DRIVER=sync` → `redis`** + jalankan worker.
5. **Hapus middleware `CheckTempJournalExistMiddleware`** atau setidaknya jangan auto-delete data user.
6. **Tambah index** `(client_id, coa_id, transaction_date)` di `journal`, `(client_id, posting_date)` di `group_journal`.
7. **Hapus `print_r/exit`** di `LedgerController` (line 96–97) & filter hardcoded `'PINJAMAN PRIBADI...'`.
8. **Hapus `hiubanhin.sql`** dari Git history (BFG / git-filter-repo) + rotate kredensial yang ada di sana.
9. **Naikkan PHP ke 7.4 minimum** (relatif kompatibel dengan Laravel 5.5) untuk dapat sedikit security patch.

---

## 8. Keputusan yang Perlu Dikonfirmasi

Sebelum mulai bangun v2:

1. **Bahasa & framework**: Laravel 11 (pilihan A) atau NestJS+Next.js (pilihan B)?
2. **Hosting**: VPS sendiri, AWS, GCP, atau on-prem? (mempengaruhi pilihan queue, storage, backup strategy)
3. **Multi-firma?** Aplikasi v2 akan dipakai 1 firma konsultan saja, atau akan jadi platform multi-firma (SaaS)? Ini menentukan apakah `firms` tabel perlu RLS juga atau cukup hard-coded 1.
4. **Single Sign-On?** Apakah konsultan butuh login via Google Workspace / Microsoft? (Laravel: Socialite; Next.js: Auth.js)
5. **Mobile app** dalam roadmap? Kalau ya, pertimbangkan pilihan B (NestJS) karena API-first dari awal.
6. **Kepatuhan**: ada kebutuhan e-Faktur, e-Bupot, atau integrasi DJP? Ini fitur tambahan yang harus masuk roadmap awal.

---

## 9. Lampiran — Daftar Bug v1 (untuk reference)

| ID | Tingkat | Lokasi | Ringkasan |
|---|---|---|---|
| B-01 | CRITICAL | `JournalController` (store/update/destroy), `CashController::store`, `GroupJournalController::importFile`, `ClientController::createClientCoa` | Tidak ada DB transaction |
| B-02 | CRITICAL | `CashController::store` | Single-sided journal entry, melanggar double-entry |
| B-03 | CRITICAL | seluruh codebase | Multi-tenant via session, tanpa enforcement DB |
| B-04 | HIGH | `CheckTempJournalExistMiddleware` | Middleware menghapus draft user di tengah workflow |
| B-05 | HIGH | DB schema | Tidak ada constraint balanced di DB |
| B-06 | HIGH | `PostingIdController::generate` | Posting number non-atomic, no UNIQUE |
| B-07 | HIGH | `Journal` model & controller | Journal mutable, tidak append-only |
| B-08 | CRITICAL (uptime) | `JournalController::destroy` | `sleep(2)` dalam HTTP request |
| B-09 | CRITICAL (uptime) | `GroupJournalController::importFile` | Excel load in-memory, sync, no queue |
| B-10 | HIGH | `journal.debet/credit` | Sejarah masalah presisi decimal |
| B-11 | MEDIUM | `Coa` model | Closure table via paket tidak terawat, banyak rekursi PHP |
| B-12 | HIGH | seluruh modul | Tidak ada period close |
| B-13 | HIGH | `BalanceSheetController`, `BalanceController`, `LedgerController` | Laporan recompute dari nol, subquery raw tanpa index |
| B-14 | MEDIUM | `LedgerController::queryLedgerData` | `print_r/exit` & filter hardcoded di production code |
| B-15 | MEDIUM | migrations | Schema tambal sulam, kolom redundan antara `journal` & `group_journal` |
| B-16 | MEDIUM | audit | Audit log bisa di-edit, bukan WORM/hash-chained |
| B-17 | HIGH | `coa.code` | UNIQUE global, bukan per client |
| B-18 | MEDIUM | repo | `hiubanhin.sql` 38 MB commit ke Git |
| B-19 | LOW | beberapa controller | Tidak ada validasi authorization beyond permission name |
