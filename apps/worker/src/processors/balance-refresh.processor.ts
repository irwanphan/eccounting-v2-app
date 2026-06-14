import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Job } from 'bullmq';

import { DbService } from '../infra/db/db.service';
import { QUEUE_NAMES } from '../queue/queue.constants';

export interface BalanceRefreshJobData {
  companyId: string; // BigInt sebagai string
  year: number;
  month: number;
  /** Jika true, refresh seluruh akun di period tsb. Jika false, hanya yang dirty. */
  full?: boolean;
  /** Jika diisi, refresh akun spesifik saja. */
  accountIds?: string[];
}

@Processor(QUEUE_NAMES.BALANCE_REFRESH, { concurrency: 4 })
export class BalanceRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(BalanceRefreshProcessor.name);

  constructor(private readonly db: DbService) {
    super();
  }

  async process(job: Job<BalanceRefreshJobData>): Promise<{ refreshed: number }> {
    const { companyId, year, month, full, accountIds } = job.data;
    const companyIdBig = BigInt(companyId);

    this.logger.log(
      `[${job.id}] refresh balance company=${companyId} period=${year}-${month} full=${full ?? false}`,
    );

    return this.db.withTenant(companyIdBig, async (tx) => {
      let targetAccounts: { account_id: bigint }[];

      if (accountIds && accountIds.length > 0) {
        targetAccounts = accountIds.map((id) => ({ account_id: BigInt(id) }));
      } else if (full) {
        const res = await tx.execute<{ account_id: bigint }>(sql`
          SELECT id AS account_id
            FROM eccounting.accounts
           WHERE company_id = ${companyIdBig}
             AND is_postable = true
             AND archived_at IS NULL
        `);
        targetAccounts = res.rows;
      } else {
        const res = await tx.execute<{ account_id: bigint }>(sql`
          SELECT account_id
            FROM eccounting.account_period_balance
           WHERE company_id = ${companyIdBig}
             AND year = ${year}::smallint
             AND month = ${month}::smallint
             AND is_dirty = true
        `);
        targetAccounts = res.rows;
      }

      let refreshed = 0;
      for (const { account_id } of targetAccounts) {
        await tx.execute(sql`
          SELECT eccounting.refresh_account_period_balance(
            ${companyIdBig}::bigint,
            ${account_id}::bigint,
            ${year}::smallint,
            ${month}::smallint
          )
        `);
        refreshed++;
      }

      this.logger.log(`[${job.id}] refreshed ${refreshed} account(s)`);
      return { refreshed };
    });
  }
}
