import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { DbService } from '../infra/db/db.service';
import { QUEUE_NAMES } from '../queue/queue.constants';

export interface HardDeleteJobData {
  entityType: 'company' | 'user' | 'audit_archive';
  entityId: string;
  requestedBy: string;
}

/**
 * Processor untuk delete asynchronous yang biasanya touch banyak row.
 *
 * Catatan: journal_entries & journal_lines IMMUTABLE oleh trigger DB.
 * Yang bisa di-hard-delete hanya:
 *   - Company yang archived & belum punya transaksi (compliance)
 *   - User yang non-active & semua membership-nya sudah dicabut
 *   - Audit log archive (move ke cold storage setelah X tahun)
 */
@Processor(QUEUE_NAMES.HARD_DELETE, { concurrency: 1 })
export class HardDeleteProcessor extends WorkerHost {
  private readonly logger = new Logger(HardDeleteProcessor.name);

  // DI placeholder — akan dipakai begitu per-entity delete logic diimplementasi
  constructor(protected readonly db: DbService) {
    super();
  }

  async process(job: Job<HardDeleteJobData>): Promise<void> {
    this.logger.warn(
      `[${job.id}] hard-delete ${job.data.entityType}=${job.data.entityId} by user=${job.data.requestedBy}`,
    );

    void this.db;
    await Promise.resolve();
  }
}
