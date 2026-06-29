import { BadRequestException, Injectable } from '@nestjs/common';
import {
  accounts,
  journalEntries,
  journalLines,
  type JournalEntry,
} from '@eccounting/db';
import type {
  CreateJournalEntryInput,
  JournalDetailRow,
  JournalGroupedRow,
  JournalLineView,
  ReverseJournalEntryInput,
} from '@eccounting/shared';
import {
  ConflictError,
  ErrorCode,
  NotFoundError,
} from '@eccounting/shared';
import { and, asc, between, desc, eq, sql } from 'drizzle-orm';

import { DbService } from '../../infra/db/db.service';
import { parseJournalImportFile, type ParsedImportLine } from './journal-import.parser';
import { buildJournalImportTemplateBuffer } from './journal-import.template';

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
        isReversed: sql<boolean>`
          EXISTS (
            SELECT 1 FROM ${journalEntries} rev
            WHERE rev.reversal_of_id = ${journalEntries.id}
          )
        `.as('is_reversed'),
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

  async createEntry(
    companyId: bigint,
    userId: bigint,
    input: CreateJournalEntryInput,
  ): Promise<{ id: string; postingNumber: string }> {
    return this.db.withTenant(companyId, async (tx) => {
      const transactionDate = input.transactionDate ?? input.postingDate;

      const postingResult = await tx.execute<{ next_posting_number: string }>(
        sql`SELECT next_posting_number(${companyId}, ${input.postingDate}::date) AS next_posting_number`,
      );
      const postingNumber = postingResult.rows[0]?.next_posting_number;
      if (!postingNumber) {
        throw new Error('Gagal generate posting number');
      }

      const [entry] = await tx
        .insert(journalEntries)
        .values({
          companyId,
          postingNumber,
          postingDate: input.postingDate,
          transactionDate,
          description: input.description ?? null,
          source: input.source ?? 'manual',
          reversalOfId: input.reversalOfId ? BigInt(input.reversalOfId) : null,
          createdBy: userId,
        })
        .returning();

      if (!entry) throw new Error('Gagal menyimpan jurnal');

      let lineNo = 1;
      for (const line of input.lines) {
        await tx.insert(journalLines).values({
          journalEntryId: entry.id,
          companyId,
          accountId: BigInt(line.accountId),
          lineNo,
          debit: line.debit,
          credit: line.credit,
          reference: line.reference ?? null,
          description: line.description ?? null,
        });
        lineNo += 1;
      }

      return { id: String(entry.id), postingNumber: entry.postingNumber };
    });
  }

  async buildImportTemplate(): Promise<{ buffer: Buffer; filename: string }> {
    const buffer = await buildJournalImportTemplateBuffer();
    return { buffer, filename: 'template import.xlsx' };
  }

  async parseImportPreview(companyId: bigint, buffer: Buffer): Promise<ParsedImportLine[]> {
    try {
      return await parseJournalImportFile(this.db, companyId, buffer);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Import gagal');
    }
  }

  async reverseEntry(
    companyId: bigint,
    userId: bigint,
    entryId: bigint,
    input: ReverseJournalEntryInput,
  ): Promise<{ id: string; postingNumber: string }> {
    return this.db.withTenant(companyId, async (tx) => {
      const [original] = await tx
        .select()
        .from(journalEntries)
        .where(and(eq(journalEntries.id, entryId), eq(journalEntries.companyId, companyId)))
        .limit(1);

      if (!original) {
        throw new NotFoundError(ErrorCode.JOURNAL_NOT_FOUND, `Jurnal ${entryId} tidak ditemukan`);
      }

      if (original.source === 'reversal') {
        throw new ConflictError(
          ErrorCode.JOURNAL_IMMUTABLE,
          'Jurnal pembalik tidak bisa dihapus/dibalik lagi',
        );
      }

      const [existingReversal] = await tx
        .select({ id: journalEntries.id })
        .from(journalEntries)
        .where(eq(journalEntries.reversalOfId, entryId))
        .limit(1);

      if (existingReversal) {
        throw new ConflictError(
          ErrorCode.JOURNAL_ALREADY_REVERSED,
          `Jurnal ${original.postingNumber} sudah dibalik`,
        );
      }

      const originalLines = await tx
        .select()
        .from(journalLines)
        .where(eq(journalLines.journalEntryId, entryId))
        .orderBy(asc(journalLines.lineNo));

      if (originalLines.length < 2) {
        throw new ConflictError(
          ErrorCode.JOURNAL_INSUFFICIENT_LINES,
          'Jurnal tidak memiliki baris yang cukup untuk dibalik',
        );
      }

      const postingDate = input.postingDate ?? new Date().toISOString().slice(0, 10);
      const postingResult = await tx.execute<{ next_posting_number: string }>(
        sql`SELECT next_posting_number(${companyId}, ${postingDate}::date) AS next_posting_number`,
      );
      const postingNumber = postingResult.rows[0]?.next_posting_number;
      if (!postingNumber) {
        throw new Error('Gagal generate posting number');
      }

      const reversalDescription =
        input.reason.trim() ||
        `Pembalikan jurnal ${original.postingNumber}${original.description ? `: ${original.description}` : ''}`;

      const [reversalEntry] = await tx
        .insert(journalEntries)
        .values({
          companyId,
          postingNumber,
          postingDate,
          transactionDate: postingDate,
          description: reversalDescription,
          source: 'reversal',
          reversalOfId: entryId,
          createdBy: userId,
        })
        .returning();

      if (!reversalEntry) throw new Error('Gagal membuat jurnal pembalik');

      let lineNo = 1;
      for (const line of originalLines) {
        await tx.insert(journalLines).values({
          journalEntryId: reversalEntry.id,
          companyId,
          accountId: line.accountId,
          lineNo,
          debit: line.credit,
          credit: line.debit,
          reference: line.reference,
          description: line.description
            ? `Reversal: ${line.description}`
            : `Reversal ${original.postingNumber}`,
        });
        lineNo += 1;
      }

      return { id: String(reversalEntry.id), postingNumber: reversalEntry.postingNumber };
    });
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
    isReversed: boolean;
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
      isReversed: row.isReversed,
      isReversal: row.source === 'reversal',
    };
  }
}
