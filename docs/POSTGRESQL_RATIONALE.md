# Kenapa PostgreSQL untuk Eccounting v2 (bukan MySQL)

> Dokumen ini membandingkan **MySQL 8** vs **PostgreSQL 16** khusus untuk kebutuhan **aplikasi akuntansi multi-company**, dan menjelaskan kenapa Eccounting v2 wajib pakai PostgreSQL.

---

## 1. TL;DR

| Pertanyaan | Jawaban |
|---|---|
| MySQL sebenarnya masih oke? | Untuk app biasa (CRUD, e-commerce ringan): ya. Untuk akuntansi multi-tenant dengan invariant ketat: **tidak cukup**. |
| Kenapa PG menang telak di sini? | Karena 3 fitur DB-level yang tidak ada / lemah di MySQL: (1) Row-Level Security native, (2) DEFERRABLE CHECK CONSTRAINT, (3) NUMERIC arbitrary precision + extension ecosystem. |
| Apa yang hilang dari MySQL? | Familiarity tim, hosting murah shared, ekosistem GUI tools Indonesia. |
| Sulit hiring developer? | Hampir semua dev Indonesia yang pernah pakai MySQL juga bisa pakai PG (SQL sama). Yang berbeda hanya operasional. Adaptation 1-2 minggu. |

**Kesimpulan: PostgreSQL wajib untuk Eccounting v2.** Detail di bawah.

---

## 2. Tabel perbandingan langsung

| Fitur | MySQL 8 | PostgreSQL 16 | Dampak untuk Eccounting |
|---|---|---|---|
| **Row-Level Security (RLS)** | ❌ Tidak ada native | ✅ Native, mature | **Multi-tenant isolation di DB level** vs harus enforced di app (rentan bug) |
| **DEFERRABLE CHECK CONSTRAINT** | ❌ Tidak ada | ✅ Native | **Balanced double-entry di-cek saat COMMIT**, bukan per-statement |
| **CHECK constraint (immediate)** | ⚠️ Ada di 8.0+ (sebelum 8.0 silently ignored) | ✅ Native sejak lama | `(debit=0) <> (credit=0)` per line di-enforce |
| **NUMERIC precision** | DECIMAL maks 65 digit | NUMERIC arbitrary precision | Untuk presisi keuangan: keduanya cukup. PG lebih flexible. |
| **MATERIALIZED VIEW** | ❌ Tidak ada (harus cron manual) | ✅ Native + `REFRESH CONCURRENTLY` | Laporan neraca/laba rugi cached di view, refresh otomatis |
| **Partial index** | ❌ Tidak ada | ✅ `WHERE status='open'` | Index untuk subset data → faster + smaller |
| **Expression index** | ⚠️ Generated columns + index | ✅ Native | Index pada `lower(name)`, `extract(year from date)`, dll. |
| **GiST / GIN / BRIN index** | ❌ Hanya B-tree, hash, FULLTEXT | ✅ Semua + extension | Pencarian teks (pg_trgm), ltree, jsonb path |
| **CTE (WITH)** | ⚠️ Sejak 8.0, recursive lemah | ✅ Mature, recursive powerful | Laporan COA hierarchical, running balance |
| **Window function** | ⚠️ Sejak 8.0, fitur dasar | ✅ Lengkap (LEAD/LAG/NTILE/PERCENT_RANK) | Aging piutang, comparison antar periode |
| **JSON support** | JSON (text-based) | **JSONB** (binary, indexable, operator lengkap) | Audit log payload, import error details |
| **Extension system** | ❌ Plugin sangat terbatas | ✅ ltree, citext, pgcrypto, pg_trgm, postgis, dst | COA hierarchical (ltree), email case-insensitive (citext), audit hash (pgcrypto) |
| **Logical replication** | ⚠️ Row-based replication (GTID) | ✅ Logical decoding native | Stream perubahan ke Kafka/Debezium untuk integrasi BI |
| **Transactional DDL** | ❌ Tidak (DDL auto-commit) | ✅ `BEGIN; ALTER TABLE; ROLLBACK;` jalan | Migration aman: bisa rollback! |
| **Online DDL** | ⚠️ Beberapa ALTER lock lama | ✅ `CREATE INDEX CONCURRENTLY`, `ALTER TABLE ... NOT VALID` | Migration di production tanpa downtime |
| **CONSTRAINT TRIGGER (deferrable)** | ❌ Trigger biasa saja | ✅ Native | Balanced check fires at COMMIT, bukan per-row |
| **Connection pooling built-in** | ⚠️ Tidak ada (perlu ProxySQL/MaxScale) | ⚠️ Tidak ada (perlu PgBouncer) | Sama-sama butuh tool eksternal |
| **MVCC** | ✅ InnoDB | ✅ Lebih sophisticated (no in-place update) | PG sedikit unggul di concurrency tinggi |
| **Vacuum / autovacuum** | n/a (InnoDB cleanup beda) | ⚠️ Perlu tuning untuk write-heavy workload | PG punya overhead operational |
| **Maturity di Indonesia** | ✅ Sangat populer | ✅ Populer (Tokopedia, Gojek, fintech) | Hiring sama mudahnya untuk dev mid-senior |
| **Hosting murah** | ✅ Banyak shared hosting | ⚠️ Lebih jarang shared, dominasi managed cloud (Supabase, Neon, RDS) | Kalau self-host Docker: sama. Kalau managed: PG malah lebih banyak option modern |
| **GUI tools** | phpMyAdmin, Workbench, DBeaver | pgAdmin, DBeaver, TablePlus, DataGrip | DBeaver/TablePlus support keduanya, GUI tidak masalah |

---

## 3. Tiga "killer feature" PostgreSQL untuk Eccounting

### 3.1 Row-Level Security (RLS) — multi-tenant aman di DB

**Masalah di v1**: setiap query harus ingat `WHERE client_id = session('client')->id`. Sekali lupa → data tenant lain bocor / tertimpa. Tidak ada safety net di DB.

**Solusi MySQL**: setiap join harus filter `client_id`. Bisa di-bypass dengan raw query. Bisa lupa di subquery (contoh nyata di `BalanceController` v1).

**Solusi PostgreSQL**: 
```sql
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON journal_entries
    USING      (company_id = current_setting('app.company_id')::bigint)
    WITH CHECK (company_id = current_setting('app.company_id')::bigint);
```

Aplikasi tinggal `SET LOCAL app.company_id = '42'` per request. **Kalau aplikasi lupa filter, DB yang menolak.** Tidak ada lagi route ke bug seperti v1.

Di MySQL tidak ada equivalent native. Ada workaround pakai VIEW per tenant, tapi maintainable nightmare.

### 3.2 DEFERRABLE CHECK / Constraint Trigger — balanced double-entry

**Masalah di v1**: validasi balanced (`SUM(debit) = SUM(credit)`) di PHP. Bisa di-bypass via raw query, bisa lupa di import, bisa race condition.

**Solusi MySQL**: trigger AFTER INSERT — tapi insert lines satu per satu, balance pasti SALAH di tengah, trigger akan reject. Workaround: bulk insert di app + cek di app + insert tanpa trigger. Tidak aman.

**Solusi PostgreSQL**:
```sql
CREATE CONSTRAINT TRIGGER je_balance_check
    AFTER INSERT ON journal_entries
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION trg_je_must_balance();
```

`DEFERRABLE INITIALLY DEFERRED` artinya: trigger jalan di **akhir transaction (COMMIT)**, bukan per-statement. Jadi flow-nya:

```sql
BEGIN;
INSERT INTO journal_entries (...);    -- trigger antri
INSERT INTO journal_lines (...) x N;  -- semua lines masuk
COMMIT;                                -- trigger fires, validasi total balance
```

Kalau tidak balance → COMMIT rejected → rollback otomatis. **Tidak mungkin ada data yang tidak balance masuk DB.** Di MySQL ini sulit dilakukan rapi.

### 3.3 Extension ecosystem — solusi out-of-the-box

| Extension | Fungsi di Eccounting | MySQL equivalent |
|---|---|---|
| **ltree** | COA hierarchical, query "semua descendant akun X" dalam 1 query GiST index | Tidak ada → harus closure table (paket franzose/closure-table di v1 yang tidak terawat) atau adjacency list rekursif |
| **citext** | Email case-insensitive native | `VARCHAR + CHECK lower()` workaround |
| **pgcrypto** | SHA256 untuk audit log hash chain, password hashing | UDF custom atau di app |
| **pg_trgm** | Pencarian teks "deskripsi jurnal mengandung 'kas'" cepat dengan GIN | FULLTEXT dengan lock issue di MySQL |
| **pg_stat_statements** | Query performance monitoring built-in | performance_schema lebih kompleks |

---

## 4. Pertimbangan lain yang sering disebut

### "MySQL lebih cepat untuk read"

Benchmark kuno yang tidak berlaku sejak PostgreSQL 9.5+. Untuk workload analytical/OLAP-tendency (= laporan akuntansi), PostgreSQL **lebih cepat**. Index types & planner lebih sophisticated.

Untuk write-heavy OLTP simple → comparable.

### "MySQL replikasi lebih mudah"

Untuk simple master-slave: benar, MySQL bawaan lebih plug-and-play.

Untuk fitur modern (logical decoding ke Kafka, multi-master, partial replication, CDC): **PostgreSQL menang telak**.

Untuk Eccounting yang akan punya BI tool / data warehouse: PostgreSQL Debezium connector matang.

### "MySQL community Indonesia lebih besar"

Benar untuk web hosting tradisional. Tapi:
- Komunitas startup Indonesia (Gojek, Tokopedia, BukaLapak, Traveloka, fintech) banyak yang pakai PostgreSQL.
- StackOverflow / dokumentasi resmi PostgreSQL **jauh lebih lengkap**.
- Buku & course berbahasa Indonesia untuk PostgreSQL memang lebih sedikit, tapi dokumentasi resmi cukup.

### "MySQL hosting lebih murah"

Untuk shared hosting tradisional: benar. Untuk modern stack:

| Kategori | MySQL option | PostgreSQL option | Catatan |
|---|---|---|---|
| Managed gratis tier | PlanetScale (deprecated free), Aiven | **Supabase (gratis 500MB)**, **Neon (gratis 3GB)** | PG lebih banyak free tier modern |
| Managed cheap | DigitalOcean Managed MySQL | DigitalOcean / Render / Railway PostgreSQL | Harga setara |
| AWS / GCP / Azure | RDS MySQL / Aurora MySQL | RDS PostgreSQL / Aurora PostgreSQL | Harga setara, Aurora PG sedikit lebih murah |
| Self-host (VPS) | Docker MySQL | Docker PostgreSQL | Setara |

### "MySQL backup lebih mudah"

`mysqldump` vs `pg_dump`: kedua sama mudahnya. PostgreSQL bahkan punya `pg_basebackup` untuk physical backup yang mudah PITR.

### "PostgreSQL lebih boros memory"

Default config: ya, MySQL InnoDB default lebih hemat. Setelah tuning (yang wajib untuk production keduanya): comparable. Untuk Eccounting di production, sediakan minimal 2GB RAM untuk PG.

---

## 5. Spesifik untuk Eccounting v2

| Masalah v1 | Solusi PostgreSQL |
|---|---|
| Multi-tenant lewat session → bocor | **RLS** + middleware `SET LOCAL app.company_id` |
| Balanced check di PHP, bisa di-bypass | **CONSTRAINT TRIGGER DEFERRABLE** |
| Posting number race | `INSERT ... ON CONFLICT DO UPDATE RETURNING` atomic |
| COA tree lambat (rekursif PHP load all) | **ltree** + GiST index, query subtree <1ms |
| Laporan recompute setiap render | **Materialized view** + scheduled `REFRESH CONCURRENTLY` |
| Audit log bisa dimanipulasi | **pgcrypto** SHA256 chain + REVOKE UPDATE/DELETE |
| Pencarian deskripsi jurnal lambat | **pg_trgm** GIN index, LIKE '%kata%' cepat |
| `coa.code` UNIQUE global (bug) | `UNIQUE (company_id, code)` — sama mudah di kedua DB |
| Period close tidak ada | Trigger BEFORE INSERT cek status — sama di kedua DB, tapi `get_period_status()` function lebih ergonomic di PG |

Dari 9 akar masalah v1, 7 di antaranya **secara eksplisit lebih mudah / lebih aman di PostgreSQL**.

---

## 6. Operational notes

### 6.1 Yang berbeda saat operasional PostgreSQL vs MySQL

| Topik | Beda |
|---|---|
| **VACUUM** | PG butuh autovacuum yang well-tuned untuk workload write-heavy (akuntansi: balance refresh job!). Kalau dibiarkan default: dead tuple menumpuk. Solusi: tune `autovacuum_vacuum_scale_factor`, `autovacuum_naptime`. |
| **Connection limit** | PG default `max_connections = 100`. Aplikasi NestJS 4 instance × 10 connection pool = 40 OK. Kalau scale lebih besar: pakai **PgBouncer** (transaction pooling). |
| **WAL / Replication** | PG pakai WAL (write-ahead log). Untuk PITR: archive WAL ke S3 dengan `wal-g`. Lebih predictable dari MySQL binlog. |
| **Statistics & ANALYZE** | PG planner sangat bergantung statistics. Setelah bulk load: jalan `ANALYZE` manual. |
| **Locking** | PG MVCC, jadi `SELECT` tidak block `UPDATE`. Tapi `ALTER TABLE` butuh `ACCESS EXCLUSIVE` lock → gunakan `CONCURRENTLY` & strategi migration safe. |

### 6.2 Setup minimal production

```yaml
# docker-compose.yml fragment
postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_DB: eccounting_v2
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD_FILE: /run/secrets/pg_password
  volumes:
    - pgdata:/var/lib/postgresql/data
    - ./postgresql.conf:/etc/postgresql/postgresql.conf
    - ./pg_hba.conf:/etc/postgresql/pg_hba.conf
  command: postgres -c config_file=/etc/postgresql/postgresql.conf
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 5s
  shm_size: 1gb   # untuk hash join besar
```

`postgresql.conf` minimal untuk app akuntansi:
```ini
shared_buffers = 1GB              # 25% RAM
effective_cache_size = 3GB        # 75% RAM
work_mem = 16MB                   # naik untuk laporan kompleks
maintenance_work_mem = 256MB
wal_level = logical               # untuk replication ke BI nanti
max_wal_size = 2GB
checkpoint_completion_target = 0.9
random_page_cost = 1.1            # asumsi SSD
effective_io_concurrency = 200    # SSD
autovacuum_vacuum_scale_factor = 0.1  # lebih sering vacuum
log_min_duration_statement = 1000  # log query >1s
```

---

## 7. Kapan MySQL bisa dipertimbangkan?

Hanya kalau:
- Tim **wajib** pakai MySQL karena alasan compliance / kebijakan korporat.
- Hosting hanya bisa MySQL (semakin jarang).
- Tidak butuh multi-tenant ketat.

Untuk Eccounting v2, **tidak ada alasan ini berlaku**.

---

## 8. Migrasi dari MySQL v1 ke PostgreSQL v2

Dijelaskan terpisah di [`MIGRATION_FROM_V1.md`](./MIGRATION_FROM_V1.md). Singkatnya: ETL script Node.js per-company, validasi balance, cutover bertahap.

---

## 9. Kesimpulan

PostgreSQL bukan sekadar "MySQL versi lain". Untuk aplikasi akuntansi serius dengan:
- Multi-tenant isolation,
- Invariant ketat (balanced, period close),
- Laporan kompleks,
- Audit trail tamper-evident,

PostgreSQL menyediakan **tools yang ada di MySQL hanya sebagai workaround atau tidak ada sama sekali**. Memilih PostgreSQL untuk Eccounting v2 = mengurangi class of bugs di akar.

Trade-off operasional (vacuum tuning, PgBouncer untuk connection scaling) jauh lebih ringan daripada trade-off correctness yang kita dapatkan.
