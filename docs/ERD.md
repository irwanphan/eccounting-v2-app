# ERD Eccounting v2

> Konteks: 1 firma konsultan pajak (firm hardcoded) mengelola banyak pembukuan **company** (klien).
> `company_id` adalah **tenant key utama**. Semua data akuntansi di-scope di sini lewat PostgreSQL Row-Level Security.

---

## 1. Diagram top-level (relationship)

```mermaid
erDiagram
    FIRMS ||--o{ USERS : "has many"
    FIRMS ||--o{ COMPANIES : "manages many"
    USERS }o--o{ COMPANIES : "via company_members"
    USERS ||--o{ COMPANY_MEMBERS : ""
    COMPANIES ||--o{ COMPANY_MEMBERS : ""

    COMPANIES ||--o{ ACCOUNTS : "owns COA"
    COMPANIES ||--o{ ACCOUNTING_PERIODS : "owns periods"
    COMPANIES ||--o{ JOURNAL_ENTRIES : "posts to"
    COMPANIES ||--o{ POSTING_NUMBER_COUNTERS : "owns counter"
    COMPANIES ||--o{ IMPORT_BATCHES : "owns imports"
    COMPANIES ||--o{ ACCOUNT_PERIOD_BALANCE : "owns snapshot"

    ACCOUNTS ||--o{ ACCOUNTS : "parent_id (tree)"
    ACCOUNTS ||--o{ JOURNAL_LINES : "posted to"
    ACCOUNTS ||--o{ ACCOUNT_PERIOD_BALANCE : ""

    ACCOUNTING_PERIODS ||--o{ JOURNAL_ENTRIES : "validates posting_date"

    JOURNAL_ENTRIES ||--|{ JOURNAL_LINES : "has 2..N lines"
    JOURNAL_ENTRIES ||--o| JOURNAL_ENTRIES : "reversal_of_id"
    IMPORT_BATCHES ||--o{ JOURNAL_ENTRIES : "produced"

    USERS ||--o{ AUDIT_LOG : "actor"
    COMPANIES ||--o{ AUDIT_LOG : "scope"
```

---

## 2. Diagram detail kolom

```mermaid
erDiagram
    FIRMS {
        bigserial id PK
        text name
        timestamptz created_at
    }
    USERS {
        bigserial id PK
        bigint firm_id FK
        citext email UK
        text password_hash
        text name
        boolean is_active
        timestamptz created_at
    }
    COMPANIES {
        bigserial id PK
        bigint firm_id FK
        text name
        varchar npwp
        char base_currency
        smallint fiscal_year_start_month
        timestamptz created_at
        timestamptz archived_at
    }
    COMPANY_MEMBERS {
        bigint company_id PK
        bigint user_id PK
        text role "owner|accountant|viewer"
        timestamptz created_at
    }
    ACCOUNTS {
        bigserial id PK
        bigint company_id FK
        bigint parent_id FK
        varchar code "UK (company_id, code)"
        text name
        text category "ASSET|LIABILITY|EQUITY|REVENUE|EXPENSE"
        char normal_balance "D|C"
        boolean is_postable
        smallint level
        ltree path
        timestamptz archived_at
        timestamptz created_at
    }
    ACCOUNTING_PERIODS {
        bigserial id PK
        bigint company_id FK
        smallint year
        smallint month
        text status "open|closed|locked"
        timestamptz closed_at
        bigint closed_by FK
        timestamptz created_at
    }
    JOURNAL_ENTRIES {
        bigserial id PK
        bigint company_id FK
        text posting_number "UK (company_id, posting_number)"
        date posting_date
        date transaction_date
        text description
        text source "manual|cash|import|reversal|adjustment|opening"
        bigint reversal_of_id FK
        bigint import_batch_id FK
        bigint created_by FK
        timestamptz created_at
    }
    JOURNAL_LINES {
        bigserial id PK
        bigint journal_entry_id FK
        bigint company_id "denormalized for RLS perf"
        bigint account_id FK
        smallint line_no
        numeric debit "DECIMAL(20,4) >= 0"
        numeric credit "DECIMAL(20,4) >= 0"
        text reference
        text description
    }
    POSTING_NUMBER_COUNTERS {
        bigint company_id PK
        char yyyymm PK
        text prefix
        int last_value
    }
    ACCOUNT_PERIOD_BALANCE {
        bigint company_id PK
        bigint account_id PK
        smallint year PK
        smallint month PK
        numeric opening
        numeric debit_total
        numeric credit_total
        numeric closing
        timestamptz refreshed_at
    }
    IMPORT_BATCHES {
        bigserial id PK
        bigint company_id FK
        text file_name
        char file_sha256 "UK (company_id, file_sha256)"
        text storage_key
        int total_rows
        int success_rows
        int failed_rows
        text status "pending|processing|done|failed"
        jsonb error_summary
        bigint created_by FK
        timestamptz created_at
        timestamptz finished_at
    }
    AUDIT_LOG {
        bigserial id PK
        bigint firm_id
        bigint company_id
        bigint actor_user_id FK
        text action
        text entity_type
        bigint entity_id
        jsonb old_values
        jsonb new_values
        inet ip_address
        text user_agent
        char prev_hash
        char row_hash
        timestamptz created_at
    }
```

---

## 3. Aturan integritas yang di-enforce di DB

| Aturan | Mekanisme |
|---|---|
| Setiap `journal_entry` harus balanced (Σdebit = Σcredit) | Constraint trigger `DEFERRABLE INITIALLY DEFERRED` |
| Setiap `journal_line`: debit XOR credit (tidak boleh keduanya 0, tidak boleh keduanya isi) | `CHECK ((debit = 0) <> (credit = 0))` |
| Tidak boleh post ke period yang `closed`/`locked` | Trigger `BEFORE INSERT` di `journal_entries` |
| `journal_entries` & `journal_lines` tidak boleh UPDATE/DELETE | Trigger penolak + revoke privilege ke role `app_user` |
| `accounts.code` unique per company | `UNIQUE (company_id, code)` |
| Posting number unique per company | `UNIQUE (company_id, posting_number)` |
| Idempotent import | `UNIQUE (company_id, file_sha256)` di `import_batches` |
| Tenant isolation | RLS policy `company_id = current_setting('app.company_id')::bigint` |
| Audit log tamper-evident | `row_hash = encode(sha256(prev_hash || row_data), 'hex')`, REVOKE UPDATE/DELETE |
| Period balance always reconcilable | Trigger di `journal_lines` insert → marker `account_period_balance.dirty = true` untuk refresh worker |

---

## 4. Sequence diagram — posting jurnal manual

```mermaid
sequenceDiagram
    autonumber
    participant U as User (browser)
    participant W as Next.js
    participant A as NestJS API
    participant DB as PostgreSQL
    participant Q as BullMQ

    U->>W: submit form posting jurnal
    W->>A: POST /v1/companies/42/journal-entries (Idempotency-Key)
    A->>A: ValidationPipe (Zod): balanced, account_id valid
    A->>A: Guard: user is member of company 42
    A->>DB: BEGIN
    A->>DB: SET LOCAL app.company_id = 42
    A->>DB: SELECT * FROM posting_number_counters WHERE company_id=42 AND yyyymm='202501' FOR UPDATE
    A->>DB: UPDATE counter SET last_value = last_value+1 RETURNING last_value
    A->>DB: INSERT journal_entries (...) RETURNING id
    Note over DB: trigger period_check (BEFORE INSERT)
    A->>DB: INSERT journal_lines (...) x N
    A->>DB: INSERT audit_log (hash chain)
    A->>DB: COMMIT
    Note over DB: DEFERRED constraint balanced_check fires here
    DB-->>A: success (atau ROLLBACK + error)
    A->>Q: enqueue balance_refresh{companyId:42, yyyymm:'202501'}
    A-->>W: 201 Created { id, postingNumber }
    W-->>U: tampil "Posting #JU20250100001 berhasil"

    Note over Q,DB: async, eventual consistent
    Q->>DB: UPSERT account_period_balance untuk akun yg terdampak
```

Kunci yang **berbeda dari v1**:
- Semua dalam satu DB transaction.
- Posting number atomic (FOR UPDATE).
- Trigger DB validate period & balanced (tidak bisa di-bypass).
- Balance refresh async (tidak menahan response user).

---

## 5. Sequence diagram — import Excel idempotent

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant W as Next.js
    participant A as NestJS API
    participant S as S3/MinIO
    participant DB as PostgreSQL
    participant Q as BullMQ
    participant Wk as Import Worker

    U->>W: upload file Excel
    W->>A: POST /v1/companies/42/imports (multipart)
    A->>A: compute SHA256(file)
    A->>DB: INSERT import_batches ON CONFLICT (company_id, file_sha256) DO NOTHING RETURNING id
    alt batch sudah ada
        A-->>W: 200 { status: "already_imported", batchId: existing }
        W-->>U: warning "File ini sudah pernah diimport"
    else batch baru
        A->>S: putObject(file)
        A->>Q: enqueue process_import { batchId }
        A-->>W: 202 Accepted { batchId, status: "pending" }
        W-->>U: tampil progress bar (polling /imports/:id)
        
        Q->>Wk: pickup
        Wk->>DB: UPDATE import_batches SET status='processing'
        Wk->>S: streamRead(file) [chunked]
        loop tiap chunk 500 baris
            Wk->>Wk: validasi baris (Zod), resolve account.code → account.id
            Wk->>DB: BEGIN
            Wk->>DB: INSERT journal_entries + lines (transactional)
            Wk->>DB: COMMIT (DEFERRED constraint balanced_check fires)
            Wk->>DB: UPDATE import_batches SET success_rows+=N
        end
        Wk->>Q: enqueue balance_refresh untuk semua period terdampak
        Wk->>DB: UPDATE import_batches SET status='done', finished_at=now()
    end
```

Yang **berbeda dari v1**:
- File hash → idempotent (replay aman).
- Streaming read (file 100MB tidak crash worker).
- Batch per 500 baris, transactional per batch.
- Async dengan progress visibility.
- Tidak ada `temp_journal` shared di DB.

---

## 6. Sequence diagram — tenant context (RLS)

```mermaid
sequenceDiagram
    autonumber
    participant Req as HTTP request
    participant Auth as JwtAuthGuard
    participant Mem as CompanyMemberGuard
    participant Tx as TenantContextInterceptor
    participant Pool as PG connection pool
    participant DB as PostgreSQL

    Req->>Auth: validate JWT → attach req.user
    Auth->>Mem: check user member of req.params.companyId
    Mem->>Tx: ok, attach tenant context
    Tx->>Pool: acquire connection
    Tx->>DB: SET LOCAL app.company_id = '42'
    Note over DB: RLS aktif untuk seluruh statement berikutnya<br/>policy: company_id = current_setting('app.company_id')::bigint
    Tx->>DB: SELECT * FROM journal_entries
    DB-->>Tx: hanya rows tenant 42
    Tx->>Pool: release connection (LOCAL hanya transaction-scope)
    Tx-->>Req: response
```

**Keamanan kunci**: kalau ada bug di service yang lupa `WHERE company_id`, **DB tetap menolak data tenant lain**. Berbeda dengan v1 yang 100% bergantung pada session PHP.

---

## 7. State machine — accounting period

```mermaid
stateDiagram-v2
    [*] --> open: created (otomatis tiap bulan baru)
    open --> closed: closePeriod (manual oleh accountant)
    closed --> open: reopenPeriod (manual, butuh permission tambahan + audit)
    closed --> locked: lockPeriod (final, tidak bisa dibuka lagi)
    locked --> [*]
    
    note right of open
      Posting & koreksi diperbolehkan
    end note
    
    note right of closed
      Tidak boleh posting baru ke period ini.
      Bisa di-reopen jika ditemukan kesalahan.
    end note
    
    note right of locked
      Final, untuk laporan pajak yang sudah dilapor.
      Koreksi hanya via journal di period berikutnya
      dengan reversal pattern.
    end note
```

---

## 8. State machine — import batch

```mermaid
stateDiagram-v2
    [*] --> pending: file uploaded
    pending --> processing: worker pickup
    processing --> done: semua baris berhasil
    processing --> failed: error tidak recoverable
    processing --> done_with_errors: sebagian baris gagal
    failed --> [*]
    done --> [*]
    done_with_errors --> [*]
```

---

## 9. Penjelasan keputusan desain

### 9.1 Kenapa `journal_lines.company_id` didenormalisasi?

RLS bekerja per tabel. Kalau `journal_lines` hanya bisa di-scope via `JOIN journal_entries`, RLS policy harus `EXISTS` subquery → lambat. Dengan menyimpan `company_id` langsung di `journal_lines`, policy jadi simple `WHERE company_id = current_setting(...)::bigint` → optimizer-friendly + index-friendly.

Konsistensi dijaga lewat trigger:
```sql
-- saat insert journal_lines, isi company_id otomatis dari journal_entries
```

### 9.2 Kenapa pakai `ltree` untuk path COA?

COA hierarchical (1, 1.1, 1.1.1, dst). Query "ambil semua descendant akun X" jadi:
```sql
SELECT * FROM accounts WHERE company_id = ? AND path <@ ?
```
Sangat cepat dengan GiST index. Tidak perlu closure table tambahan seperti v1.

### 9.3 Kenapa `posting_number_counters` tabel sendiri, bukan PostgreSQL `SEQUENCE`?

PostgreSQL SEQUENCE tidak rollback saat transaction failed → akan ada "gap" di nomor jurnal. Untuk akuntansi yang menuntut nomor berurutan tanpa gap (audit), tabel + `FOR UPDATE` lebih cocok.

### 9.4 Kenapa `account_period_balance` di-snapshot, bukan view?

Karena laporan jalan setiap hari, ratusan kali. View = recompute tiap query. Snapshot = upsert sekali saat ada perubahan, dibaca berkali-kali. Untuk akuntansi yang **write << read**, ini optimisasi besar.

Snapshot bisa di-refresh:
1. **Pas posting jurnal**: enqueue job refresh untuk period terdampak (eventual consistent, biasanya <1 detik).
2. **Cron harian**: full refresh untuk validasi (jaga konsistensi vs raw journal).

### 9.5 Kenapa `audit_log` dengan hash chain?

```
row_hash[N] = sha256(row_hash[N-1] || row_data[N])
```

Kalau ada baris di-edit/delete (misal DBA usil), hash chain putus → terdeteksi saat verify. Standar audit yang lebih serius dari sekedar "tabel terpisah".

### 9.6 Kenapa `reversal_of_id` di `journal_entries`?

Append-only design: koreksi = entry baru dengan tanda `reversal_of_id` menunjuk entry lama. Original tetap ada (immutable), pembalik tercatat eksplisit. Audit trail bersih, tidak ada "data hilang misterius".

---

## 10. Daftar file SQL migration

```
migrations/
├── 0001_extensions.sql              -- citext, ltree, pgcrypto
├── 0002_roles.sql                   -- app_user, app_admin role
├── 0003_core_tables.sql             -- firms, users, companies, company_members
├── 0004_accounts_periods.sql        -- accounts (COA dengan ltree), accounting_periods
├── 0005_ledger.sql                  -- journal_entries, journal_lines
├── 0006_ledger_constraints.sql      -- balanced trigger, period trigger, immutability trigger
├── 0007_reporting.sql               -- account_period_balance, posting_number_counters
├── 0008_import_audit.sql            -- import_batches, audit_log (hash chain trigger)
├── 0009_rls.sql                     -- enable RLS + policies di semua tabel tenant
└── 0010_indexes.sql                 -- composite indexes untuk laporan & lookup

seeds/
└── coa_default_indonesia.sql        -- COA standar Indonesia, dipakai saat company baru dibuat
```

Setiap file akan **idempotent** (`IF NOT EXISTS`, `CREATE OR REPLACE`) sehingga aman di-rerun.
