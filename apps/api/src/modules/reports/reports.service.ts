import { Injectable } from '@nestjs/common';
import { accounts, journalEntries, journalLines } from '@eccounting/db';
import type { AccountOption, GeneralLedgerReport } from '@eccounting/shared';
import { and, asc, between, eq, lt, sql } from 'drizzle-orm';

import { DbService } from '../../infra/db/db.service';

@Injectable()
export class ReportsService {
  constructor(private readonly db: DbService) {}

  async listAccountOptions(companyId: bigint): Promise<AccountOption[]> {
    const rows = await this.db.db
      .select({
        id: accounts.id,
        code: accounts.code,
        name: accounts.name,
        level: accounts.level,
        isPostable: accounts.isPostable,
      })
      .from(accounts)
      .where(and(eq(accounts.companyId, companyId), eq(accounts.isPostable, true)))
      .orderBy(asc(accounts.code));

    return rows.map((row) => ({
      id: String(row.id),
      code: row.code,
      name: row.name,
      level: row.level,
      isPostable: row.isPostable,
    }));
  }

  async getGeneralLedger(
    companyId: bigint,
    accountId: bigint,
    dateStart: string,
    dateEnd: string,
  ): Promise<GeneralLedgerReport | null> {
    const [account] = await this.db.db
      .select({
        id: accounts.id,
        code: accounts.code,
        name: accounts.name,
        normalBalance: accounts.normalBalance,
      })
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.companyId, companyId)))
      .limit(1);

    if (!account) return null;

    const [opening] = await this.db.db
      .select({
        totalDebit: sql<string>`COALESCE(SUM(${journalLines.debit}), 0)::text`.as('total_debit'),
        totalCredit: sql<string>`COALESCE(SUM(${journalLines.credit}), 0)::text`.as('total_credit'),
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
      .where(
        and(
          eq(journalLines.companyId, companyId),
          eq(journalLines.accountId, accountId),
          lt(journalEntries.transactionDate, dateStart),
        ),
      );

    let running =
      account.normalBalance === 'D'
        ? Number(opening?.totalDebit ?? 0) - Number(opening?.totalCredit ?? 0)
        : Number(opening?.totalCredit ?? 0) - Number(opening?.totalDebit ?? 0);

    const openingBalance = running;

    const rows = await this.db.db
      .select({
        transactionDate: journalEntries.transactionDate,
        postingNumber: journalEntries.postingNumber,
        reference: journalLines.reference,
        description: journalLines.description,
        debit: journalLines.debit,
        credit: journalLines.credit,
        lineNo: journalLines.lineNo,
        entryId: journalEntries.id,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
      .where(
        and(
          eq(journalLines.companyId, companyId),
          eq(journalLines.accountId, accountId),
          between(journalEntries.transactionDate, dateStart, dateEnd),
        ),
      )
      .orderBy(
        asc(journalEntries.transactionDate),
        asc(journalEntries.id),
        asc(journalLines.lineNo),
      );

    const lines = rows.map((row, index) => {
      const amount =
        account.normalBalance === 'D'
          ? Number(row.debit) - Number(row.credit)
          : Number(row.credit) - Number(row.debit);
      running += amount;
      return {
        lineNo: index + 1,
        transactionDate: row.transactionDate,
        postingNumber: row.postingNumber,
        reference: row.reference,
        description: row.description,
        amount: amount.toFixed(4),
        balance: running.toFixed(4),
      };
    });

    return {
      account: {
        id: String(account.id),
        code: account.code,
        name: account.name,
        normalBalance: account.normalBalance,
      },
      dateStart,
      dateEnd,
      openingBalance: openingBalance.toFixed(4),
      closingBalance: running.toFixed(4),
      lines,
    };
  }
}
