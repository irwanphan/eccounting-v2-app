# API Style Guide untuk Eccounting v2

> Tujuan dokumen ini: memberikan kamu cukup pemahaman untuk memilih antara **REST + OpenAPI**, **tRPC**, atau **hybrid** sebagai gaya komunikasi antara `apps/api` (NestJS) dan `apps/web` (Next.js) — plus mempersiapkan untuk konsumer lain (mobile, 3rd party).

---

## 1. TL;DR

| Pilihan | Cocok kalau... | Tidak cocok kalau... |
|---|---|---|
| **REST + OpenAPI codegen** | Mau bisa konsumsi dari mana saja (mobile, integrasi pihak ketiga, BI tool, e-Faktur, dll.) | Tim kecil, scope tertutup, tidak butuh stability spec |
| **tRPC** | Web + API dalam 1 tim, 1 monorepo, TS only, mau iterate cepat tanpa codegen | Akan ada client non-TS (Android Kotlin, iOS Swift, partner external) |
| **Hybrid (tRPC web + REST publik)** | Punya **dua audiens berbeda**: internal app cepat develop, dan partner/mobile butuh contract formal | Overhead maintain 2 layer terlalu berat untuk tim kecil |

**Rekomendasi untuk Eccounting v2: REST + OpenAPI** (dengan penjelasan di bawah).

---

## 2. Konsep singkat tiap pilihan

### 2.1 REST + OpenAPI

**Cara kerja:**
- NestJS mendefinisikan controller dengan decorator `@Get`, `@Post`, dll.
- `@nestjs/swagger` auto-generate spek OpenAPI (JSON) dari decorator + DTO.
- Frontend menjalankan **codegen** (`openapi-typescript`, `orval`, `Hey API`) → menghasilkan TypeScript types + fetch client.
- Frontend memanggil API lewat client yang sudah type-safe.

```
[NestJS decorator + DTO] → [openapi.json] → [codegen] → [TS client + types di apps/web]
```

**Contoh alur dev:**
```bash
# Backend
nest g resource journal-entry            # generate controller + DTO
npm run build                            # build → swagger spec ke openapi.json

# Frontend
pnpm openapi-codegen                     # baca openapi.json → generate TS client
```

**Contoh kode frontend:**
```ts
import { JournalEntryApi } from '@/generated/api';

const api = new JournalEntryApi(config);
const res = await api.create({ companyId: 1n, postingDate: '2025-01-15', lines: [...] });
// res.data type-safe sesuai DTO backend
```

### 2.2 tRPC

**Cara kerja:**
- Backend mendefinisikan router dengan procedure yang return value Zod-validated.
- Frontend **import langsung** type dari backend (lewat shared workspace package).
- Tidak ada codegen — TypeScript type inference langsung jalan.
- Komunikasi tetap lewat HTTP, tapi shape dikelola di TS level.

```
[backend router] → (import type via monorepo) → [frontend hook] = end-to-end TS type
```

**Contoh:**
```ts
// apps/api/src/router/journal.ts
export const journalRouter = router({
  create: protectedProcedure
    .input(createJournalEntrySchema)
    .mutation(async ({ input, ctx }) => ctx.journalService.postEntry(...)),
});

// apps/web (langsung import type)
const trpc = useTRPC();
const mutation = trpc.journal.create.useMutation();
mutation.mutate({ companyId: 1n, lines: [...] });  // type-safe
```

### 2.3 Hybrid (tRPC internal + REST publik)

- **tRPC** dipakai untuk komunikasi `apps/web` ↔ `apps/api` (internal, fast iteration).
- **REST + OpenAPI** dipakai untuk:
  - Mobile app (jika ada)
  - Partner integration (e-Faktur, accountant lain, BI tool)
  - Webhook dari pihak ketiga

NestJS mendukung keduanya bersamaan — satu controller bisa expose REST + procedure tRPC dengan service yang sama di belakang.

---

## 3. Perbandingan detail

| Aspek | REST + OpenAPI | tRPC | Hybrid |
|---|---|---|---|
| **Type safety end-to-end** | ✅ via codegen (1 step build) | ✅ instant, no codegen | ✅ keduanya |
| **Spec contract formal** | ✅ OpenAPI = standar industri | ⚠️ tidak (TS types saja) | ✅ untuk REST bagian |
| **Client non-TS** (mobile, Java, .NET, Python) | ✅ codegen ke bahasa apapun | ❌ TS only | ✅ via REST |
| **Versioning API publik** | ✅ dengan path/header version | ⚠️ ad-hoc | ✅ |
| **Documentation otomatis** | ✅ Swagger UI / Scalar / Redoc | ⚠️ harus build sendiri | ✅ |
| **Testing dengan Postman/Insomnia/curl** | ✅ langsung | ❌ kurang nyaman | ✅ untuk REST |
| **Iterasi cepat di internal** | ⚠️ butuh codegen step | ✅ paling cepat | ✅ |
| **Caching / CDN** | ✅ standard HTTP semantics | ⚠️ POST default, harder cache | ✅ |
| **Streaming response** | ✅ via SSE/chunked | ✅ via subscription | ✅ |
| **Bundle size frontend** | sedang (client+types) | kecil (cuma import type) | sedang |
| **Learning curve** | rendah (standar HTTP) | sedang (konsep router/procedure) | sedang-tinggi |
| **Tooling ecosystem** | sangat besar | kecil tapi solid | besar |
| **Compatibility ke depan** | sangat tinggi (REST = forever) | tergantung tRPC project sehat | tinggi |
| **Stability spec API** | ✅ kontrak jelas | ⚠️ mudah accidentally breaking | ✅ untuk REST |

---

## 4. Pertimbangan khusus untuk Eccounting v2

### 4.1 Kemungkinan konsumer API

| Konsumer | Probabilitas | Implikasi |
|---|---|---|
| Web app internal (konsultan) | 100% (sudah pasti) | Bisa tRPC atau REST |
| Mobile app konsultan | tinggi 1-2 tahun ke depan | **butuh REST/OpenAPI** |
| Integrasi e-Faktur DJP | tinggi (regulasi pajak Indonesia) | DJP umumnya REST/SOAP → mudah dari REST |
| Integrasi bank API (rekening koran auto-import) | sedang | bank API = REST → konsumer kita = REST/internal |
| Partner accountant (akses akun client mereka) | mungkin | **butuh REST publik dengan API key/OAuth** |
| Export ke BI tool (Metabase, PowerBI) | mungkin | butuh REST atau direct PostgreSQL read replica |
| Webhook untuk billing/notification | mungkin | webhook = HTTP POST = sudah REST-friendly |

Kesimpulan: **kemungkinan besar akan butuh REST publik**, baik sekarang atau 1-2 tahun ke depan. Membangun REST dari awal lebih murah daripada migrate dari tRPC nanti.

### 4.2 Profil tim

- Tim akan develop web + (kemungkinan) mobile.
- Belum tentu semua developer TS expert (apalagi kalau hire kontraktor untuk mobile).
- Akan ada **handover ke pihak ketiga** (auditor, partner) yang butuh dokumentasi API.

→ Spec formal (OpenAPI) membantu komunikasi.

### 4.3 Compliance & audit

Audit pajak / kantor akuntan publik kadang minta dokumentasi API endpoint yang dipakai. OpenAPI = lebih mudah serahkan dokumen formal.

---

## 5. Rekomendasi final

### Pilihan utama: **REST + OpenAPI codegen** ⭐

Alasan:
1. **Future-proof** — kalau besok butuh mobile/3rd party, sudah siap.
2. **Spec formal** — bagus untuk dokumentasi, audit, handover.
3. **Standard industri** — semua developer paham REST.
4. **NestJS support sangat bagus** — `@nestjs/swagger` zero-friction.
5. **Hiring** — REST adalah standard, tidak butuh skill tRPC khusus.
6. **Type safety tetap end-to-end** lewat codegen.

**Overhead-nya:** harus jalankan codegen tiap ubah API. Solusi: integrate di CI dan dev script (`turbo dev` jalan paralel sama auto-regen).

### Kalau tim merasa REST + codegen terlalu lambat iterasinya

→ **Hybrid**: tRPC untuk web internal + REST publik. Trade-off: kompleksitas naik, tapi DX internal lebih cepat.

### Pure tRPC

→ **Tidak direkomendasikan** untuk Eccounting v2 karena:
- Kemungkinan butuh konsumer non-TS sangat tinggi.
- Susah dokumentasi formal.
- Lock-in ke TS ecosystem.

Tapi tidak salah kalau scope strict internal-only + tidak ada plan mobile. Dalam kasus itu, tRPC sangat produktif.

---

## 6. Detail implementasi REST + OpenAPI di Eccounting v2

### 6.1 Standar response

Konsisten response wrapper:

```ts
// success
{
  "data": { ... },
  "meta": { "page": 1, "perPage": 50, "total": 1234 }   // jika list
}

// error
{
  "error": {
    "code": "JOURNAL_UNBALANCED",
    "message": "Sum of debit (1000) does not equal credit (900)",
    "details": { ... }
  }
}
```

### 6.2 Versioning

URL-based: `/v1/companies/:id/journal-entries`. Kalau breaking change → `/v2/...` paralel jalan, deprecate v1 setelah 6 bulan.

### 6.3 Pagination

Cursor-based untuk tabel besar (jurnal):
```
GET /v1/companies/42/journal-entries?cursor=eyJpZCI6MTAwfQ&limit=50
```

Page-based untuk dashboard kecil (companies list, dll).

### 6.4 Filtering & sorting

```
GET /v1/companies/42/journal-entries?
  from=2025-01-01&to=2025-12-31&
  accountId=123&
  sort=-postingDate
```

### 6.5 Authentication

- **JWT access token** (15 menit) + refresh token (7 hari)
- Header: `Authorization: Bearer <token>`
- Tenant context: `X-Company-Id: 42` (di-validate ke membership user)

### 6.6 Idempotency untuk write

POST yang sensitif (posting jurnal, import) pakai header:
```
Idempotency-Key: <uuid v4 dari client>
```
Server cache key+response 24 jam → safe retry.

### 6.7 Rate limiting (untuk public API kelak)

- Per API key: 60 req/menit untuk read, 10 req/menit untuk write.
- Response header: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

### 6.8 Codegen pipeline

```
apps/api: nest build → emit openapi.json ke packages/api-spec/

packages/api-spec/:
  - openapi.json (generated)
  - Dockerfile (optional: untuk Stoplight/Scalar preview)

apps/web: 
  scripts/codegen.sh:
    pnpm openapi-typescript ../../packages/api-spec/openapi.json -o src/generated/api.ts
    pnpm orval --config orval.config.ts   # untuk react-query hooks

turbo.json:
  pipeline:
    "api#build": { outputs: ["dist/**", "../../packages/api-spec/**"] }
    "web#dev":   { dependsOn: ["^build"] }  # web tunggu api codegen siap
```

Hasil: setiap controller baru di NestJS, frontend langsung dapat type & react-query hook tanpa edit manual.

### 6.9 Recommended tools

| Need | Tool |
|---|---|
| OpenAPI generation dari NestJS | `@nestjs/swagger` |
| TS types dari OpenAPI | `openapi-typescript` (Hey API juga bagus) |
| React Query hooks dari OpenAPI | `orval` atau `@hey-api/openapi-ts` |
| Swagger UI alternatif lebih cantik | Scalar (`@scalar/nestjs-api-reference`) |
| Spec linting | Spectral |
| Mock server (untuk dev frontend tanpa backend running) | Prism |

---

## 7. Kalau pakai Hybrid — bagaimana strukturnya

```
apps/api/src/
├── modules/
│   └── journal/
│       ├── journal.service.ts          # single source of truth
│       ├── journal.controller.ts       # REST endpoint
│       └── journal.trpc.ts             # tRPC procedure → call service yang sama
└── main.ts                             # mount kedua: /v1/* dan /trpc/*

apps/web/src/
├── lib/
│   ├── rest/                           # untuk fitur publik / yang butuh OpenAPI
│   └── trpc/                           # untuk fitur internal cepat
```

Aturan main: **service layer di NestJS tetap satu**. REST controller & tRPC procedure cuma **fasad**. Tidak ada logic duplikasi.

---

## 8. Keputusan yang perlu kamu konfirmasi

Setelah baca dokumen ini:

1. **Pilih REST + OpenAPI?** → Saya scaffold dengan setup `@nestjs/swagger` + `openapi-typescript` di monorepo.
2. **Pilih tRPC?** → Saya scaffold dengan `@trpc/server` + `@trpc/react-query` integration.
3. **Pilih Hybrid?** → Saya scaffold keduanya dengan struktur facade pattern.

Default rekomendasi saya tetap **opsi 1 (REST + OpenAPI)**.
