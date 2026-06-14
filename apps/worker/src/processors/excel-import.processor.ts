import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Job } from 'bullmq';

import { DbService } from '../infra/db/db.service';
import { QUEUE_NAMES } from '../queue/queue.constants';

export interface ExcelImportJobData {
  companyId: string;
  batchId: string;
}

/**
 * Skeleton untuk processor import Excel.
 *
 * Implementasi lengkap akan:
 *  1. Update import_batches.status = 'processing'
 *  2. Stream-read Excel dari S3/MinIO (chunked, untuk file besar)
 *  3. Validasi tiap row dengan Zod, resolve account.code → account.id
 *  4. Insert journal_entries + lines per chunk (transactional, DEFERRED balance check)
 *  5. Update import_batches counters (success_rows, failed_rows)
 *  6. Enqueue balance-refresh untuk periods terdampak
 *  7. Update import_batches.status = 'done' / 'done_with_errors' / 'failed'
 */
@Processor(QUEUE_NAMES.EXCEL_IMPORT, { concurrency: 2 })
export class ExcelImportProcessor extends WorkerHost {
  private readonly logger = new Logger(ExcelImportProcessor.name);

  constructor(private readonly db: DbService) {
    super();
  }

  async process(job: Job<ExcelImportJobData>): Promise<void> {
    const { companyId, batchId } = job.data;
    this.logger.log(`[${job.id}] process import batch=${batchId} company=${companyId}`);

    await this.db.withTenant(BigInt(companyId), async (tx) => {
      await tx.execute(sql`
        UPDATE eccounting.import_batches
           SET status = 'processing', started_at = now()
         WHERE id = ${BigInt(batchId)}
      `);
    });

    // TODO: stream Excel, parse, insert journal entries + lines
    this.logger.warn(`[${job.id}] excel parsing not yet implemented`);

    await this.db.withTenant(BigInt(companyId), async (tx) => {
      await tx.execute(sql`
        UPDATE eccounting.import_batches
           SET status = 'failed',
               finished_at = now(),
               error_summary = ${JSON.stringify({ error: 'NOT_IMPLEMENTED' })}::jsonb
         WHERE id = ${BigInt(batchId)}
      `);
    });
  }
}
