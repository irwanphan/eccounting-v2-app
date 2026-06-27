import { Injectable } from '@nestjs/common';
import {
  accounts,
  journalEntries,
  journalLines,
  type JournalEntry,
} from '@eccounting/db';
import type {
  JournalDetailRow,
  JournalGroupedRow,
  JournalLineView,
} from '@eccounting/shared';
import { and, asc, between, desc, eq, sql } from 'drizzle-orm';

import { DbService } from '../../infra/db/db.service';

@Injectable()
export class JournalsService {
  constructor(private readonly db: DbService) {}

  async listGrouped(
    companyId: bigint,
    dateStart: string,
    dateEnd: string,
  ): Promise<JournalGroupedRow[]> {
    const rows = await this.db.db
      .select({
        id: journalEntries.id,
        postingNumber: journalEntries.postingNumber,
        postingDate: journalEntries.postingDate,
        description: journalEntries.description,
        source: journalEntries.source,
        importBatchId: journalEntries.importBatchId,
        totalDebit: sql<string>`COALESCE(SUM(${journalLines.debit}), 0)::text`.as('total_debit'),
        totalCredit: sql<string>`COALESCE(SUM(${journalLines.credit}), 0)::text`.as('total_credit'),
      })
      .from(journalEntries)
      .leftJoin(journalLines, eq(journalLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalEntries.companyId, companyId),
          between(journalEntries.postingDate, dateStart, dateEnd),
        ),
      )
      .groupBy(journalEntries.id)
      .orderBy(desc(journalEntries.postingDate), desc(journalEntries.postingNumber));

    return rows.map((row) => this.toGroupedRow(row));
  }

  async listDetail(
    companyId: bigint,
    dateStart: string,
    dateEnd: string,
  ): Promise<JournalDetailRow[]> {
    const rows = await this.db.db
      .select({
        id: journalLines.id,
        journalEntryId: journalLines.journalEntryId,
        postingNumber: journalEntries.postingNumber,
        postingDate: journalEntries.postingDate,
        transactionDate: journalEntries.transactionDate,
        accountCode: accounts.code,
        accountName: accounts.name,
        description: journalLines.description,
        debit: journalLines.debit,
        credit: journalLines.credit,
      })
      .from(journalEntries)
      .innerJoin(journalLines, eq(journalLines.journalEntryId, journalEntries.id))
      .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
      .where(
        and(
          eq(journalEntries.companyId, companyId),
          between(journalEntries.postingDate, dateStart, dateEnd),
        ),
      )
      .orderBy(
        desc(journalEntries.postingDate),
        asc(journalEntries.postingNumber),
        asc(journalLines.lineNo),
      );

    return rows.map((row) => ({
      id: String(row.id),
      journalEntryId: String(row.journalEntryId),
      postingNumber: row.postingNumber,
      postingDate: row.postingDate,
      transactionDate: row.transactionDate,
      accountCode: row.accountCode,
      accountName: row.accountName,
      description: row.description,
      debit: String(row.debit),
      credit: String(row.credit),
    }));
  }

  async getEntryLines(companyId: bigint, entryId: bigint): Promise<{
    entry: JournalEntry;
    lines: JournalLineView[];
  } | null> {
    const [entry] = await this.db.db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.id, entryId), eq(journalEntries.companyId, companyId)))
      .limit(1);

    if (!entry) return null;

    const lines = await this.db.db
      .select({
        id: journalLines.id,
        lineNo: journalLines.lineNo,
        transactionDate: journalEntries.transactionDate,
        accountCode: accounts.code,
        accountName: accounts.name,
        reference: journalLines.reference,
        description: journalLines.description,
        debit: journalLines.debit,
        credit: journalLines.credit,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
      .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
      .where(eq(journalLines.journalEntryId, entryId))
      .orderBy(asc(journalLines.lineNo));

    return {
      entry,
      lines: lines.map((line) => ({
        id: String(line.id),
        lineNo: line.lineNo,
        transactionDate: line.transactionDate,
        accountCode: line.accountCode,
        accountName: line.accountName,
        reference: line.reference,
        description: line.description,
        debit: String(line.debit),
        credit: String(line.credit),
      })),
    };
  }

  private toGroupedRow(row: {
    id: bigint;
    postingNumber: string;
    postingDate: string;
    description: string | null;
    source: string;
    importBatchId: bigint | null;
    totalDebit: string;
    totalCredit: string;
  }): JournalGroupedRow {
    return {
      id: String(row.id),
      postingNumber: row.postingNumber,
      postingDate: row.postingDate,
      description: row.description,
      source: row.source,
      importBatchId: row.importBatchId ? String(row.importBatchId) : null,
      totalDebit: row.totalDebit,
      totalCredit: row.totalCredit,
      isImported: row.importBatchId !== null || row.source === 'import',
    };
  }
}
