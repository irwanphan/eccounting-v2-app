# Panduan DevOps — Deploy & Migrasi v1 → v2

> Dokumen operasional untuk tim DevOps: menaikkan Eccounting v2 ke server, menjalankan ETL, dan cutover bertahap **tanpa menurunkan v1** sampai setiap company divalidasi.
>
> **Audience:** DevOps / Sysadmin. Detail mapping data & query recon: [`MIGRATION_FROM_V1.md`](./MIGRATION_FROM_V1.md).

---

## 1. Ringkasan eksekutif

| Aturan | Penjelasan |
|---|---|
| **v1 tetap production** | Jangan stop/replace v1 sampai cutover per company selesai + diverifikasi |
| **v2 = environment paralel** | Subdomain/port berbeda (mis. `v2.eccounting.firma.com`) |
| **Dua database terpisah** | v1 = MySQL 5.7, v2 = PostgreSQL 16 — **tidak bisa** satu `DATABASE_URL` |
| **ETL = CLI di server** | Script Node.js, bukan fitur UI; baca v1 (READ ONLY), tulis ke v2 |
| **Cutover per company** | Bukan big-bang semua klien sekaligus |
| **Migrate all ≠ cutover all** | Boleh load data banyak company ke v2 staging; arahkan user tetap satu per satu |

---

## 2. Deploy v2 di server yang sama dengan v1 — apakah OK?

### Rekomendasi: **Ya, untuk fase UAT/staging/pilot** — dengan syarat

Menaruh container v2 di server yang sama dengan v1 **masuk akal** untuk tahap awal karena:

- ETL bisa akses MySQL v1 via `127.0.0.1` (latency rendah, tanpa buka port MySQL ke internet)
- Tidak perlu server baru dulu
- v1 dan v2 tetap terisolasi lewat port, subdomain, dan database berbeda

### Risiko yang harus dikelola

| Risiko | Mitigasi |
|---|---|
| v1 sudah pernah down saat load berat | Jadwalkan ETL **di luar jam kerja**; batasi concurrency ETL (1–3 company paralel max) |
| RAM habis (MySQL + PHP-FPM + PG + Redis + Node) | Minimal **8 GB RAM** server; set `mem_limit` per container v2 |
| Disk I/O penuh | Volume Docker PG **terpisah** dari data MySQL; monitor `iostat` saat ETL |
| Port bentrok | PG v2 jangan bind `5432` host jika MySQL pakai port lain — map ke port internal (mis. `5433:5432`) |
| Blast radius | Jangan share `.env` v1/v2; backup terpisah; rollback v2 tidak menyentuh v1 |

### Spesifikasi server minimal (sama dengan v1 + v2 paralel)

| Resource | Minimum | Disarankan |
|---|---|---|
| RAM | 6 GB | **8–16 GB** |
| CPU | 4 vCPU | 4+ vCPU |
| Disk | SSD, +20 GB untuk PG volume | SSD NVMe, monitor growth PG |
| OS | Ubuntu 22.04 LTS | Sama |

### Kapan pindah ke server terpisah / managed DB?

- Saat pilot sukses dan traffic v2 mendekati production
- Saat ETL full history membuat server sibuk berjam-jam
- Saat ingin HA / backup PG managed (RDS, Neon, DO Managed DB)

**Kesimpulan:** server sama = **OK untuk mulai**. PostgreSQL production jangka panjang lebih aman di managed service atau disk terpisah; aplikasi v2 (api/web/worker) boleh tetap di server yang sama dengan v1 selama resource cukup.

---

## 3. Arsitektur di server (coexist dengan v1)

```mermaid
flowchart TB
    subgraph Internet
        U1[Konsultan - v1]
        U2[Tim internal - v2 UAT]
    end

    subgraph Server["Server yang sama"]
        NGX[Nginx / reverse proxy]

        subgraph V1["v1 - JANGAN DIUBAH"]
            PHP[PHP-FPM / Laravel]
            MY[(MySQL 5.7)]
        end

        subgraph V2["v2 - Docker Compose production"]
            WEB[web container :3000]
            API[api container :3001]
            WRK[worker container]
            PG[(postgres :5432 internal)]
            RD[(redis :6379 internal)]
            S3M[minio atau skip - pakai R2]
        end

        ETL[ETL CLI - one-shot container atau host]
    end

    U1 --> NGX --> PHP --> MY
    U2 --> NGX --> WEB
    WEB --> API --> PG
    API --> RD
    WRK --> RD
    WRK --> PG
    ETL -->|READ ONLY| MY
    ETL -->|WRITE| PG
```

### Port & URL (contoh)

| Service | URL publik | Port internal |
|---|---|---|
| v1 Laravel | `https://eccounting.firma.com` | existing (80/443 → php-fpm) |
| v2 Web | `https://v2.eccounting.firma.com` | 3000 |
| v2 API | `https://v2.eccounting.firma.com/v1` (proxy) | 3001 |
| PostgreSQL v2 | **tidak diekspos** ke internet | 5432 (hanya docker network) |
| Redis v2 | **tidak diekspos** | 6379 |
| MinIO (dev/UAT) | opsional, internal saja | 9000 |

---

## 4. Prasyarat sebelum deploy

### 4.1 Di server

- [ ] Docker Engine ≥ 24 + Docker Compose v2
- [ ] Node.js ≥ 20 (untuk migration runner & ETL, bisa di CI atau image terpisah)
- [ ] Git / registry access ke image v2
- [ ] Nginx (atau Traefik) untuk TLS + reverse proxy subdomain v2
- [ ] Backup v1 MySQL **terbaru** (full dump) sebelum ETL pertama

### 4.2 Akun MySQL read-only untuk ETL

Buat user khusus — **jangan** pakai kredensial aplikasi v1:

```sql
-- Jalankan di MySQL v1 (sebagai admin)
CREATE USER 'eccounting_etl'@'localhost' IDENTIFIED BY '<password_kuat>';
GRANT SELECT ON eccounting_1_prod.* TO 'eccounting_etl'@'localhost';
-- Jika audit DB terpisah:
GRANT SELECT ON auditing.* TO 'eccounting_etl'@'localhost';
FLUSH PRIVILEGES;
```

Di `.env` v2:

```env
V1_MYSQL_HOST=127.0.0.1
V1_MYSQL_PORT=3306
V1_MYSQL_USER=eccounting_etl
V1_MYSQL_PASSWORD=<password_kuat>
V1_MYSQL_DATABASE=eccounting_1_prod
```

### 4.3 Status implementasi aplikasi (cek dengan tim dev)

Sebelum konsultan dipindah ke v2, modul berikut harus **production-ready**:

| Modul | Wajib untuk cutover? |
|---|---|
| Auth (login) | ✅ |
| Companies + picker | ✅ |
| COA (accounts) | ✅ |
| Periods | ✅ |
| Journal posting | ✅ |
| Reports (neraca, LR, buku besar) | ✅ |
| Import Excel | ⚠️ jika konsultan pakai fitur ini |
| ETL jurnal lengkap (`apps/etl-v1-to-v2/`) | ✅ untuk migrasi data historis |

Lihat status terkini di [`../README.md`](../README.md) §Status implementasi.

---

## 5. Tahapan deploy & migrasi (checklist DevOps)

### Fase 0 — Siapkan v2 di server (v1 tidak disentuh)

**Tujuan:** v2 hidup di subdomain baru, database kosong + schema.

```bash
# 1. Clone / pull repo di server (atau deploy dari registry image)
cd /opt/eccounting-v2-app

# 2. Environment production
cp .env.example .env
# Edit: JWT_SECRET, passwords, API_CORS_ORIGINS, NEXT_PUBLIC_API_URL, dll.

# 3. Naikkan infra v2 (sesuaikan compose production — lihat §6)
docker compose -f docker-compose.prod.yml up -d

# 4. Schema PostgreSQL
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:seed
./scripts/setup-roles.sh

# 5. Health check
curl -sf http://localhost:3001/v1/health/ready
```

**Checklist:**

- [ ] v1 masih bisa diakses normal
- [ ] v2 `/v1/health/ready` return 200
- [ ] PostgreSQL tidak terbuka ke publik (`ss -tlnp | grep 5432` hanya docker0)
- [ ] TLS aktif di Nginx untuk subdomain v2

---

### Fase 1 — Bootstrap identitas (users + companies)

**Tujuan:** user v1 bisa login ke v2; daftar company muncul — **belum ada jurnal**.

```bash
# Dry-run dulu
pnpm db:bootstrap-from-v1 --dry-run

# Eksekusi
pnpm db:bootstrap-from-v1
```

**Checklist:**

- [ ] Jumlah user v2 ≈ user v1 (aktif)
- [ ] Jumlah company v2 ≈ client v1
- [ ] Login 1 user uji di v2 berhasil (password v1 masih valid, lazy rehash ke argon2id)
- [ ] v1 tidak ada perubahan data

---

### Fase 2 — ETL data historis (per company)

> **Script lengkap:** `apps/etl-v1-to-v2/` — **belum tersedia** saat dokumen ini dibuat. Interface CLI yang direncanakan ada di §7. Sementara Fase 1 saja yang bisa dijalankan.

**Aturan emas:**

1. **Jangan** `migrate-all` di run pertama — mulai **1 company kecil**
2. Selalu `--dry-run` → migrate → `reconcile` → baru lanjut
3. ETL dijalankan **di server** (akses ke MySQL + PostgreSQL)
4. Jadwalkan di **malam / weekend** untuk company besar

**Alur per company:**

```bash
# 1. Validasi data v1 (smoke test) — lihat MIGRATION_FROM_V1.md §4.1
pnpm etl:validate --v1-client-id=42

# 2. Dry-run migrate
pnpm etl:migrate-company --v1-client-id=42 --dry-run

# 3. Migrate
pnpm etl:migrate-company --v1-client-id=42

# 4. Reconciliation — HARUS match sebelum cutover
pnpm etl:reconcile --v1-client-id=42 --output=./recon/company-42.csv

# 5. Jika mismatch → STOP, eskalasi ke tim dev/akuntan
```

**Setelah pilot 1 company sukses**, lanjut batch kecil:

```bash
pnpm etl:migrate-batch --v1-client-ids=5,12,18 --skip-on-error
pnpm etl:reconcile-all --output=./recon/
```

**Checklist per company:**

- [ ] Smoke test v1 lolos (tidak ada group_journal imbalance)
- [ ] COA ter-migrate
- [ ] Journal entries + lines ter-migrate
- [ ] Recon saldo per akun match (tolerance ≤ 0.01)
- [ ] Neraca & laba rugi periode terakhir match
- [ ] Akun `ZZZZ-V1MIG` (suspense cash v1) sudah di-review konsultan

---

### Fase 3 — UAT / shadow mode (tim internal)

**Tujuan:** bandingkan hasil v2 vs v1 tanpa mengganggu produksi.

| Aktivitas | Di v1 | Di v2 |
|---|---|---|
| Posting resmi konsultan | ✅ tetap di sini | ❌ jangan untuk data resmi |
| Lihat laporan historis | ✅ | ✅ bandingkan |
| Posting uji / duplikat | ✅ (opsional) | ✅ untuk tes |

**Checklist:**

- [ ] Minimal 2 konsultan power-user terlatih UI v2
- [ ] Daftar mismatch UI/angka didokumentasikan
- [ ] Bug kritis v2 fixed sebelum cutover

---

### Fase 4 — Cutover per company

**Hanya setelah** recon pass + UAT OK untuk company tersebut.

**Langkah DevOps + bisnis:**

1. **Komunikasi** ke konsultan: company X pindah ke v2 pada tanggal Y
2. **Freeze posting v1** untuk company X (koordinasi dengan app v1 — read-only atau block write)
3. **ETL delta** — transaksi baru sejak migrasi awal:
   ```bash
   pnpm etl:migrate-company --v1-client-id=42 --since=2025-06-01
   pnpm etl:reconcile --v1-client-id=42
   ```
4. **Recon final** — harus match
5. **Arahkan user** ke `https://v2.eccounting.firma.com`
6. **v1 company X** → read-only (arsip), jangan dihapus dulu

**Checklist cutover** (lengkap: [`MIGRATION_FROM_V1.md`](./MIGRATION_FROM_V1.md) §8):

- [ ] Saldo neraca akhir bulan terakhir match
- [ ] Laba rugi periode terakhir match
- [ ] Backup v1 company ini tersimpan
- [ ] Tim support standby 24 jam pertama

---

### Fase 5 — Decommission v1

Setelah **semua** company cutover + periode stabil (disarankan 1 bulan):

- [ ] Export arsip final MySQL
- [ ] Matikan v1 app (pertahankan dump arsip minimal 7 tahun sesuai kebijakan)
- [ ] Reclaim resource server / turunkan container v1

---

## 6. Docker production di server yang sama

> **Catatan:** `docker-compose.yml` di repo saat ini = **dev only**. Tim dev perlu menyediakan `docker-compose.prod.yml` + Dockerfile (api, web, worker) sebelum deploy image. Bagian ini adalah **target layout** untuk DevOps.

### 6.1 Perbedaan dev vs production

| Komponen | Dev (`docker-compose.yml`) | Production (disarankan) |
|---|---|---|
| PostgreSQL | Container di server | Container **atau** managed PG |
| Redis | Container | Container **atau** Upstash |
| MinIO | Container | **Cloudflare R2 / S3** (hindari MinIO prod di server sama) |
| MailHog | Container | SMTP production (SendGrid, dll.) |
| api / web / worker | `pnpm dev` di host | **Docker image** |

### 6.2 Contoh `docker-compose.prod.yml` (kerangka)

```yaml
name: eccounting-v2-prod

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_SUPERUSER}
      POSTGRES_PASSWORD: ${POSTGRES_SUPERUSER_PASSWORD}
    volumes:
      - /var/lib/eccounting-v2/postgres:/var/lib/postgresql/data
    # JANGAN publish ke 0.0.0.0 — hanya internal network
    expose:
      - "5432"
    shm_size: 512mb
    mem_limit: 2g

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - /var/lib/eccounting-v2/redis:/data
    expose:
      - "6379"
    mem_limit: 512m

  api:
    image: registry.example.com/eccounting-api:${VERSION}
    restart: unless-stopped
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - "127.0.0.1:3001:3001"
    mem_limit: 1g

  worker:
    image: registry.example.com/eccounting-worker:${VERSION}
    restart: unless-stopped
    env_file: .env
    depends_on: [postgres, redis]
    mem_limit: 1g

  web:
    image: registry.example.com/eccounting-web:${VERSION}
    restart: unless-stopped
    environment:
      NEXT_PUBLIC_API_URL: https://v2.eccounting.firma.com/v1
    ports:
      - "127.0.0.1:3000:3000"
    mem_limit: 512m
```

### 6.3 Nginx snippet (subdomain v2)

```nginx
server {
    listen 443 ssl http2;
    server_name v2.eccounting.firma.com;

    # ssl_certificate ...

    location /v1/ {
        proxy_pass http://127.0.0.1:3001/v1/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 120s;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }
}
```

---

## 7. Command reference

### Tersedia sekarang

| Command | Di mana dijalankan | Fungsi |
|---|---|---|
| `pnpm db:migrate` | Server v2 / CI | Apply schema PostgreSQL |
| `pnpm db:seed` | Server v2 | Load function COA |
| `./scripts/setup-roles.sh` | Server v2 | Set password role PG |
| `pnpm db:bootstrap-from-v1` | Server dengan akses MySQL v1 | Import firm, users, companies |
| `pnpm db:bootstrap-from-v1 --dry-run` | Sama | Preview tanpa write |

### Direncanakan (ETL lengkap)

| Command | Fungsi |
|---|---|
| `pnpm etl:validate --v1-client-id=N` | Smoke test data v1 sebelum migrate |
| `pnpm etl:migrate-company --v1-client-id=N` | Migrate satu company |
| `pnpm etl:migrate-company --v1-client-id=N --dry-run` | Simulasi |
| `pnpm etl:migrate-company --v1-client-id=N --since=DATE` | Delta sync |
| `pnpm etl:migrate-batch --v1-client-ids=1,2,3` | Batch kecil |
| `pnpm etl:migrate-all --skip-on-error` | Semua company (hanya setelah pilot sukses) |
| `pnpm etl:reconcile --v1-client-id=N` | Bandingkan saldo v1 vs v2 |

**Penting:** `migrate-all` **tidak** menggantikan recon per company dan **tidak** melakukan cutover otomatis.

---

## 8. Variabel environment kunci

| Variabel | Production | Catatan |
|---|---|---|
| `DATABASE_URL` | `postgres://app_user:...@postgres:5432/eccounting_v2` | Aplikasi runtime — **selalu PostgreSQL** |
| `DATABASE_ADMIN_URL` | Superuser / admin | Hanya migration & ETL |
| `V1_MYSQL_*` | Host MySQL v1 | **READ ONLY user** — hanya ETL/bootstrap |
| `JWT_SECRET` | Random ≥ 64 char | Wajib beda dari staging |
| `API_CORS_ORIGINS` | `https://v2.eccounting.firma.com` | |
| `NEXT_PUBLIC_API_URL` | `https://v2.eccounting.firma.com/v1` | |
| `REDIS_URL` | Internal docker / Upstash | |
| `S3_*` | R2/S3 production | Ganti MinIO di prod |
| `SWAGGER_ENABLED` | `false` | Di production |

**Jangan pernah:**

- Set `DATABASE_URL` ke MySQL v1
- Commit `.env` ke Git
- Expose port PostgreSQL / Redis ke `0.0.0.0`

---

## 9. Backup & rollback

### Backup wajib

| Apa | Frekuensi | Retensi |
|---|---|---|
| MySQL v1 (full) | Harian + sebelum setiap ETL besar | Min. 30 hari |
| PostgreSQL v2 | Harian (`pg_dump`) + WAL jika memungkinkan | Min. 30 hari |
| `.env` production | Setiap perubahan | Secure vault |
| Recon report CSV | Setiap migrate company | Permanen sampai cutover |

```bash
# Contoh backup PG v2
docker compose exec -T postgres pg_dump -U postgres -Fc eccounting_v2 \
  > /backup/eccounting_v2_$(date +%Y%m%d).dump
```

### Rollback

| Situasi | Tindakan |
|---|---|
| v2 deploy gagal | Stop container v2; v1 tidak terpengaruh |
| ETL company X salah | Truncate data company X di v2 (script dev) + re-run ETL; v1 tidak disentuh |
| Cutover company X bermasalah | Arahkan user kembali ke v1 (masih read-only/archive); fix v2 + delta ETL |

**v1 tetap sumber kebenaran** sampai cutover company tersebut dinyatakan final.

---

## 10. Yang TIDAK boleh dilakukan

| ❌ | Alasan |
|---|---|
| Stop / replace v1 saat deploy v2 | Konsultan kehilangan akses produksi |
| `migrate-all` tanpa pilot 1 company | Sulit debug; satu data buruk mengacaukan semua |
| Cutover semua company sekaligus | Tidak ada rollback granular |
| ETL pakai user MySQL dengan WRITE | Risiko korupsi data v1 |
| ETL jam sibuk (09–17) | Beban baca MySQL mengganggu v1 |
| Hapus MySQL v1 sebelum semua company cutover + arsip | Kehilangan data historis |
| Expose PostgreSQL ke internet | Risiko keamanan |

---

## 11. Timeline perkiraan (setelah aplikasi v2 feature-complete)

| Fase | Durasi |
|---|---|
| Fase 0 — Deploy infra v2 | 1–2 hari |
| Fase 1 — Bootstrap users/companies | 1 hari |
| Fase 2 — ETL + recon pilot (1 company) | 3–5 hari |
| Fase 2b — ETL batch sisanya (~30 company) | 2–4 minggu (malam/weekend) |
| Fase 3 — UAT shadow | 2 minggu |
| Fase 4 — Cutover per company | 3–5 hari × jumlah batch |
| Fase 5 — Decommission v1 | 1 minggu |

Detail estimasi bisnis: [`MIGRATION_FROM_V1.md`](./MIGRATION_FROM_V1.md) §9.

---

## 12. Eskalasi & kontak

| Masalah | Eskalasi ke |
|---|---|
| Recon mismatch | Tim dev + konsultan akuntan |
| ETL script error | Tim dev (backend) |
| Server resource / Docker | DevOps |
| User tidak bisa login pasca cutover | DevOps (env) + dev (auth) |
| Data v1 tidak balance (smoke test gagal) | Konsultan — perbaiki di v1 dulu |

---

## 13. Dokumen terkait

| Dokumen | Isi |
|---|---|
| [`MIGRATION_FROM_V1.md`](./MIGRATION_FROM_V1.md) | Mapping tabel, query recon, smoke test SQL |
| [`POSTGRESQL_RATIONALE.md`](./POSTGRESQL_RATIONALE.md) | Kenapa PG terpisah dari MySQL v1 |
| [`ERD.md`](./ERD.md) | Retensi file import (§5.1) |
| [`AUDIT_REKOMENDASI_V2.md`](./AUDIT_REKOMENDASI_V2.md) | Konteks bug v1 & prinsip v2 |
| [`../README.md`](../README.md) | Status implementasi modul aplikasi |

---

*Terakhir diperbarui: sesuai fase pre-ETL (bootstrap-from-v1 tersedia; ETL jurnal penuh dalam pengembangan).*
