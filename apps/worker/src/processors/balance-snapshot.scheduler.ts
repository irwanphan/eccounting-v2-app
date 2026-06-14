import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { sql } from 'drizzle-orm';
import type { Queue } from 'bullmq';

import { DbService } from '../infra/db/db.service';
import { QUEUE_NAMES } from '../queue/queue.constants';
import type { BalanceRefreshJobData } from './balance-refresh.processor';

@Injectable()
export class BalanceSnapshotScheduler {
  private readonly logger = new Logger(BalanceSnapshotScheduler.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.BALANCE_REFRESH) private readonly queue: Queue<BalanceRefreshJobData>,
    private readonly db: DbService,
  ) {}

  /**
   * Tiap 5 menit: refresh semua row balance yang dirty.
   * Trigger di journal_lines INSERT akan mark dirty; worker ini batch refresh.
   */
  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'balance-refresh-dirty' })
  async refreshDirty(): Promise<void> {
    const res = await this.db.rawDb().execute<{
      company_id: bigint;
      year: number;
      month: number;
    }>(sql`
      SELECT DISTINCT company_id, year, month
        FROM eccounting.account_period_balance
       WHERE is_dirty = true
       LIMIT 100
    `);

    if (res.rows.length === 0) return;

    this.logger.log(`enqueue balance-refresh untuk ${res.rows.length} period(s)`);
    for (const row of res.rows) {
      await this.queue.add(
        'refresh',
        {
          companyId: String(row.company_id),
          year: row.year,
          month: row.month,
          full: false,
        },
        {
          removeOnComplete: 1000,
          removeOnFail: 5000,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );
    }
  }

  /**
   * Jam 1 pagi WIB tiap hari: refresh full untuk period bulan berjalan
   * di semua company aktif (jaga konsistensi vs raw journal).
   */
  @Cron('0 1 * * *', { name: 'balance-refresh-daily-full', timeZone: 'Asia/Jakarta' })
  async dailyFullRefresh(): Promise<void> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const companies = await this.db.rawDb().execute<{ id: bigint }>(sql`
      SELECT id FROM eccounting.companies WHERE archived_at IS NULL
    `);

    this.logger.log(
      `enqueue daily full refresh untuk ${companies.rows.length} company(s) period=${year}-${month}`,
    );

    for (const company of companies.rows) {
      await this.queue.add('refresh-full', {
        companyId: String(company.id),
        year,
        month,
        full: true,
      });
    }
  }
}
