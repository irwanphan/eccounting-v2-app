# Kenapa NestJS untuk Eccounting v2

> Dokumen ini menjelaskan alasan teknis & bisnis memilih **NestJS** sebagai framework backend, dan kapan Next.js (alone) tidak cukup.

---

## 1. TL;DR

| Pertanyaan | Jawaban singkat |
|---|---|
| Next.js bisa untuk backend? | Bisa, lewat Route Handlers & Server Actions. |
| Kalau bisa, kenapa pakai NestJS? | Karena Eccounting v2 adalah **aplikasi backend serius** (banyak modul, heavy queue, scheduled jobs, audit, future API publik). Next.js dirancang untuk web rendering, bukan untuk men-host business logic kompleks. |
| Apakah NestJS overkill? | Tidak untuk profil ini. NestJS overkill kalau aplikasi cuma UI + form sederhana. Untuk akuntansi multi-company dengan worker, posting engine, period close, audit log immutable, dll. — NestJS justru menyederhanakan. |
| Kenapa bukan Express/Fastify raw? | Bisa, tapi kita akan membangun ulang yang NestJS sudah sediakan (DI, validation, module, swagger, queue integration). Net effort lebih besar. |

---

## 2. Apa itu NestJS sebenarnya?

NestJS adalah **opinionated framework backend Node.js** yang:

- Ditulis 100% TypeScript-first.
- Mengikuti **arsitektur modular ala Angular/Spring**: `Module`, `Controller`, `Provider/Service`, `Repository`.
- Pakai **decorator** (`@Controller`, `@Get`, `@Injectable`, `@Module`) untuk metadata.
- **Dependency Injection** native (constructor-based).
- Bisa run di atas **Express** (default) atau **Fastify** (lebih cepat, recommended untuk produksi).
- Punya CLI generator yang konsisten.
- Punya ekosistem resmi: queue, scheduler, swagger, microservice, websocket, graphql, dll.

Contoh struktur module di NestJS:

```ts
// journal.module.ts
@Module({
  imports: [DbModule, AuditModule, BullModule.registerQueue({ name: 'balance-refresh' })],
  controllers: [JournalController],
  providers: [JournalService, JournalRepository, PostingNumberService],
  exports: [JournalService],
})
export class JournalModule {}

// journal.service.ts
@Injectable()
export class JournalService {
  constructor(
    private readonly repo: JournalRepository,
    private readonly postingNumber: PostingNumberService,
    private readonly db: DrizzleService,
    @InjectQueue('balance-refresh') private readonly balanceQueue: Queue,
  ) {}

  async postEntry(companyId: bigint, dto: CreateJournalEntryDto, userId: bigint) {
    return this.db.transaction(async (tx) => {
      const postingNumber = await this.postingNumber.next(tx, companyId, dto.postingDate);
      const entry = await this.repo.insert(tx, { ...dto, companyId, postingNumber, createdBy: userId });
      await this.repo.insertLines(tx, entry.id, dto.lines);
      await this.balanceQueue.add('refresh', { companyId, period: yyyymm(dto.postingDate) });
      return entry;
    });
  }
}
```

Hal yang ingin diperhatikan:
- `@Injectable` membuat class bisa di-inject ke mana saja.
- Constructor mendeklarasikan **dependency** — testable (tinggal mock di unit test).
- `@InjectQueue` — integrasi BullMQ resmi.
- `this.db.transaction` — DI bisa membungkus connection pool & transaction handling.

---

## 3. Next.js vs NestJS untuk backend — perbandingan praktis

| Kapabilitas | Next.js (Route Handlers + Server Actions) | NestJS |
|---|---|---|
| **HTTP routing** | File-based (`app/api/.../route.ts`) | Decorator-based (`@Controller('/journal') @Get(':id')`) |
| **Dependency Injection** | Tidak ada native; manual / library `tsyringe` | Native, constructor-based, hierarchical scope |
| **Module system** | Tidak ada (convention sendiri) | Built-in (`@Module`), dengan import/export, lifecycle, lazy loading |
| **Validation request** | Manual / Zod / class-validator di setiap handler | Global `ValidationPipe` + DTO; otomatis di semua endpoint |
| **Middleware berbasis policy** | `middleware.ts` global + per route checking | `Guard`, `Interceptor`, `Pipe`, `Filter` — granular per route/controller/global |
| **Queue (BullMQ)** | Harus jalan terpisah; tidak ada framework integration | `@nestjs/bullmq` native, worker bisa share modul |
| **Cron / scheduler** | Tidak ada built-in (Vercel Cron / external) | `@nestjs/schedule` — decorator `@Cron('0 0 * * *')` |
| **WebSocket** | Tidak ada built-in | `@nestjs/websockets` (Socket.IO atau ws) |
| **OpenAPI / Swagger UI** | Manual via library third-party | `@nestjs/swagger` auto-generate dari decorator + DTO |
| **Microservices (TCP, Redis, Kafka, gRPC)** | Tidak ada | `@nestjs/microservices` native |
| **Testing backend logic** | Mock Request/Response Next.js (kompleks) | DI testing module, `Test.createTestingModule().overrideProvider(...)` — sangat mudah |
| **CLI generator** | n/a untuk backend | `nest g resource journal` → generate module + controller + service + DTO + test stub |
| **Logging** | `console.log` atau library manual | Pino/winston built-in, decorator-aware |
| **Error handling** | try/catch per handler | Global `ExceptionFilter` + per-exception class |
| **Hot reload backend** | Bundled di Next dev server | `nest start --watch` (instan, hanya rebuild backend) |
| **Scaling out** | Vertical (1 Next.js process) atau Vercel functions | Bisa pecah service per modul jika perlu, atau jalan satu monolith — fleksibel |

### Tabel sederhana: kapan pakai apa

| Profil aplikasi | Cocok |
|---|---|
| Marketing site, blog, e-commerce dengan backend tipis | Next.js sendiri |
| SaaS dashboard dengan API kecil, tim 1-2 orang | Next.js + Route Handlers + Drizzle |
| Aplikasi internal CRUD sederhana | Next.js sendiri |
| **Aplikasi business dengan banyak modul** (akuntansi, ERP, payroll, billing) | **NestJS + Next.js terpisah** |
| Aplikasi dengan worker/job berat | **NestJS** (atau Next.js + worker terpisah, akhirnya sama) |
| Aplikasi yang akan punya mobile app / 3rd party API | **NestJS** (API-first) |
| Aplikasi enterprise dengan compliance ketat | **NestJS** (struktur jelas, audit-able) |

---

## 4. 12 alasan konkret pakai NestJS untuk Eccounting v2

### 4.1 Struktur modul yang scale dengan domain akuntansi

Eccounting v2 akan punya minimal **15-20 modul**:

```
auth, users, firms, companies, members,
accounts (COA), periods (period close),
journal (posting), reports (neraca, laba rugi, buku besar, neraca saldo),
import (Excel batch), audit (log immutable),
balance (snapshot), notification, settings, integrations
```

Tanpa framework opinionated, struktur akan **divergen antar developer**. NestJS memaksakan pola yang sama: setiap domain = 1 module dengan controller + service + repository + DTO + test.

### 4.2 Dependency Injection = testability tinggi

Akuntansi membutuhkan unit test ketat (posting harus balance, period harus locked, dst). DI membuat ini trivial:

```ts
// journal.service.spec.ts
const module = await Test.createTestingModule({
  providers: [
    JournalService,
    { provide: JournalRepository, useValue: mockRepo },
    { provide: PostingNumberService, useValue: mockPostingNumber },
    { provide: DrizzleService, useValue: mockDb },
    { provide: getQueueToken('balance-refresh'), useValue: mockQueue },
  ],
}).compile();

const service = module.get(JournalService);

// test: posting ke period closed harus reject
mockDb.transaction.mockRejectedValue(new PeriodClosedError());
await expect(service.postEntry(1n, validDto, 1n)).rejects.toThrow(PeriodClosedError);
```

Tanpa DI: harus monkey-patch import, mock manual filesystem, dll.

### 4.3 Queue worker share module dengan API

Import Excel = job berjalan menit-jaman. Harus async. Dengan NestJS:

```ts
// import.processor.ts (worker)
@Processor('excel-import')
export class ExcelImportProcessor {
  constructor(
    private readonly importService: ImportService,
    private readonly journalService: JournalService, // ← reuse module yang sama
  ) {}

  @Process('process-file')
  async handle(job: Job<{ batchId: bigint }>) {
    return this.importService.processBatch(job.data.batchId);
  }
}
```

Worker memakai **JournalService yang sama** dengan API. Tidak perlu duplikasi business logic.

Kalau pakai Next.js, harus bikin process Node terpisah dan **re-import** service tanpa benefit DI/module → akhirnya kamu tetap "punya NestJS-rasa" tapi dibangun tangan.

### 4.4 Scheduled jobs first-class

```ts
@Injectable()
export class BalanceSnapshotJob {
  constructor(private readonly balanceService: BalanceService) {}

  @Cron('0 1 * * *') // setiap hari jam 1 pagi
  async refreshAllBalances() {
    await this.balanceService.refreshAllOpenPeriods();
  }

  @Cron('0 0 1 * *') // setiap awal bulan
  async autoCloseLastMonth() {
    await this.balanceService.lockPreviousMonth();
  }
}
```

Dekorator, langsung jalan. Di Next.js: Vercel Cron berbayar/limit, atau setup `node-cron` manual.

### 4.5 Validation otomatis via global pipe

```ts
// main.ts (sekali setup)
app.useGlobalPipes(new ZodValidationPipe());

// DTO
export const CreateJournalEntryDto = z.object({
  companyId: z.bigint(),
  postingDate: z.coerce.date(),
  description: z.string().optional(),
  lines: z.array(z.object({
    accountId: z.bigint(),
    debit: z.number().nonnegative(),
    credit: z.number().nonnegative(),
  })).min(2).refine(
    (lines) => lines.reduce((s, l) => s + l.debit - l.credit, 0) === 0,
    'Journal lines must balance',
  ),
});

// Controller
@Post()
create(@Body() dto: CreateJournalEntryDto) {
  return this.svc.postEntry(...);
}
```

Validation jalan otomatis sebelum controller method. Body type-safe.

### 4.6 OpenAPI auto-generate

`@nestjs/swagger` membaca decorator + DTO → menghasilkan **swagger UI + JSON spec otomatis**. Spec ini bisa dipakai:
- Dokumentasi API live (`/api/docs`)
- Codegen TypeScript client untuk frontend (`openapi-typescript` / `orval`)
- Codegen client untuk mobile (Android/iOS)
- Konsumsi 3rd party (e-Faktur integrator)

Single source of truth.

### 4.7 Guard untuk authorization granular

```ts
@Controller('companies/:companyId/journal')
@UseGuards(JwtAuthGuard, CompanyMemberGuard)
export class JournalController {

  @Post()
  @RequireRole('accountant', 'owner')   // ← decorator custom
  @SetTenantContext()                   // ← Interceptor: SET LOCAL app.company_id
  create(@Param('companyId') companyId: bigint, @Body() dto: CreateJournalEntryDto, @CurrentUser() user: User) {
    return this.svc.postEntry(companyId, dto, user.id);
  }
}
```

Kombinasi guard + decorator membuat **policy enforcement** rapih dan reusable.

### 4.8 Interceptor untuk tenant context (RLS)

Ini penting untuk Eccounting karena RLS PostgreSQL:

```ts
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly db: DrizzleService) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest();
    const companyId = req.params.companyId ?? req.headers['x-company-id'];

    return new Observable((subscriber) => {
      this.db.runWithTenant(BigInt(companyId), async () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
```

Ini mengeset `SET LOCAL app.company_id` di connection yang dipakai handler. Otomatis di seluruh API.

### 4.9 Exception filter terstruktur

```ts
@Catch()
export class BusinessExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof PeriodClosedError) { /* 422 */ }
    if (exception instanceof UnbalancedJournalError) { /* 422 */ }
    if (exception instanceof PostingNumberConflictError) { /* 409 */ }
    // ...
  }
}
```

Konsisten format error response di seluruh API. Frontend tahu pasti shape error.

### 4.10 Microservice-ready

Kalau suatu hari fitur tertentu (misal: laporan PDF generator, e-Faktur sync) jadi bottleneck, NestJS membuat **pecahnya** mudah — convert module jadi microservice dengan transport TCP/Redis/Kafka tanpa rewrite business logic.

### 4.11 Audit log otomatis via interceptor

```ts
@UseInterceptors(AuditLogInterceptor)
@Post()
create(...) { ... }
```

Interceptor capture: actor, action, entity, before/after diff → insert ke `audit_log` (hash-chained). Cross-cutting concern, satu tempat.

### 4.12 Hiring & onboarding

NestJS structure **mirip Spring Boot, Laravel, atau Angular**. Senior developer dari ekosistem tersebut bisa **produktif dalam hitungan hari**, bukan bulan. Code review juga lebih cepat karena pola sudah baku.

---

## 5. Trade-off jujur — kapan NestJS bukan pilihan terbaik

| Situasi | Pilih ini |
|---|---|
| MVP cepat, scope kecil, 1 developer | Next.js + Route Handlers + Drizzle (skip NestJS) |
| Aplikasi UI-heavy, backend hampir tidak ada | Next.js |
| Tim sangat tidak familiar dengan OOP/decorator (functional-purist) | Hono atau Fastify dengan struktur manual |
| Performance ultra-critical, latency p99 <10ms | Hono di Bun, atau Go |
| Edge runtime (Cloudflare Workers) | Hono (NestJS tidak jalan di edge) |

**Untuk Eccounting v2 tidak ada poin di atas yang berlaku.**

---

## 6. Alternatif yang valid (kalau NestJS terasa berat)

| Framework | Trade-off |
|---|---|
| **Hono** | Sangat ringan, web-standard. Cocok untuk edge. Tapi tidak ada DI/module/scheduler — harus build sendiri. |
| **Fastify** | Lebih cepat dari Express, ekosistem plugin bagus. Butuh setup module sendiri. |
| **AdonisJS** | Mirip Laravel di Node — full-stack, ORM bawaan, opinionated. Cocok kalau tim ex-Laravel. Lebih kecil ekosistem dari Nest. |
| **Tinkerwell / Encore.ts** | Newer, infra-as-code. Belum mature untuk production akuntansi. |

Kalau tim ex-Laravel dan suka pola "convention over configuration" Laravel, **AdonisJS** layak dipertimbangkan sebagai alternatif NestJS. Mental model lebih dekat ke Laravel.

---

## 7. Cara NestJS dipakai di Eccounting v2 (konkret)

Struktur folder usulan:

```
apps/api/
├── src/
│   ├── main.ts                          # bootstrap
│   ├── app.module.ts                    # root module
│   ├── common/
│   │   ├── guards/                      # JwtAuthGuard, CompanyMemberGuard
│   │   ├── interceptors/                # TenantContext, AuditLog
│   │   ├── pipes/                       # ZodValidationPipe
│   │   ├── filters/                     # BusinessExceptionFilter
│   │   ├── decorators/                  # @CurrentUser, @RequireRole
│   │   └── errors/                      # PeriodClosedError, UnbalancedJournalError, dll.
│   ├── infra/
│   │   ├── db/                          # DrizzleService (provider untuk koneksi PG)
│   │   ├── queue/                       # BullMQ setup
│   │   ├── storage/                     # S3/MinIO service
│   │   └── auth/                        # JWT strategy, password hashing
│   ├── modules/
│   │   ├── auth/                        # login, refresh, logout
│   │   ├── users/
│   │   ├── firms/
│   │   ├── companies/                   # CRUD company + member management
│   │   ├── accounts/                    # COA tree management
│   │   ├── periods/                     # accounting_periods, open/close/lock
│   │   ├── journal/                     # core posting engine
│   │   ├── cash/                        # cash in/out → tetap pakai journal engine
│   │   ├── import/                      # Excel import, idempotent
│   │   ├── balance/                     # account_period_balance refresh
│   │   ├── reports/
│   │   │   ├── ledger/                  # buku besar
│   │   │   ├── trial-balance/           # neraca saldo
│   │   │   ├── balance-sheet/           # neraca
│   │   │   └── income-statement/        # laba rugi
│   │   ├── audit/                       # log query + integrity verify
│   │   └── settings/
│   └── workers/
│       ├── excel-import.processor.ts
│       ├── balance-refresh.processor.ts
│       └── hard-delete.processor.ts
└── test/
    ├── unit/
    └── e2e/
```

Modul `journal` jadi inti — semua mutasi keuangan (manual, cash, import) **akhirnya melewati `JournalService.postEntry`** yang membungkus seluruh logic (transaction, posting number, balanced check, period check, audit log).

Dengan begini, **tidak ada kasus seperti v1** di mana `CashController` bypass dan bikin single-sided entry.

---

## 8. Kesimpulan

NestJS dipilih untuk Eccounting v2 bukan karena hype, tapi karena:

1. **Domain akuntansi menuntut struktur ketat** (banyak modul, banyak invariant).
2. **Heavy background processing** (import, balance, scheduled jobs) butuh framework yang treat queue sebagai first-class.
3. **Plan multi-frontend & 3rd party integration** menuntut API-first design dengan OpenAPI auto-generate.
4. **Compliance & audit** lebih mudah dengan interceptor & guard yang konsisten.
5. **Tim akan tumbuh** — struktur opinionated mempercepat onboarding & menjaga konsistensi.
6. **Next.js akan tetap dipakai untuk frontend** — gunakan masing-masing untuk apa yang terbaik:
   - **Next.js** → UI, server components, image/font optimization, server actions untuk form sederhana.
   - **NestJS** → core business logic, posting engine, worker, scheduler, audit.
