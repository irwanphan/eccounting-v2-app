import { Injectable } from '@nestjs/common';
import { accounts, journalEntries, journalLines } from '@eccounting/db';
import type {
  AccountCategory,
  AccountOption,
  BalanceSheetReport,
  GeneralLedgerReport,
} from '@eccounting/shared';
import { and, asc, between, eq, inArray, lte, lt, sql } from 'drizzle-orm';

import { DbService } from '../../infra/db/db.service';
import { DEFAULT_BALANCE_SHEET_TEMPLATE } from './balance-sheet.template';

/** Setara v1 CoaCategory::KELOMPOK['PENDAPATAN'] — category_id 1,2,3 */
const REVENUE_CATEGORIES: AccountCategory[] = ['REVENUE', 'OTHER_INCOME'];

/** Setara v1 CoaCategory::KELOMPOK['BIAYA'] — category_id 4,5,6,7,8 */
const EXPENSE_CATEGORIES: AccountCategory[] = ['COGS', 'EXPENSE', 'OTHER_EXPENSE', 'TAX_EXPENSE'];

const PL_CATEGORIES: AccountCategory[] = [...REVENUE_CATEGORIES, ...EXPENSE_CATEGORIES];

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
        category: accounts.category,
        isRetainedEarning: accounts.isRetainedEarning,
      })
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.companyId, companyId)))
      .limit(1);

    if (!account) return null;

    const isPlAccount = PL_CATEGORIES.includes(account.category);
    const isRetainedEarningAccount = account.isRetainedEarning;

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

    // v1: akun PENDAPATAN/BIAYA selalu mulai dari 0
    if (isPlAccount) {
      running = 0;
    }

    // v1: akun Laba Rugi Periode Berjalan ditambah saldo P/L kumulatif sebelum periode
    if (isRetainedEarningAccount) {
      running += await this.calculateRetainedEarningsBefore(companyId, dateStart);
    }

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

    let retainedEarningsInPeriod: string | null = null;
    if (isRetainedEarningAccount) {
      const periodPl = await this.calculateRetainedEarningsInPeriod(companyId, dateStart, dateEnd);
      retainedEarningsInPeriod = periodPl.toFixed(4);
      running += periodPl;
    }

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
      retainedEarningsInPeriod,
      lines,
    };
  }

  async getBalanceSheet(companyId: bigint, month: string): Promise<BalanceSheetReport> {
    const { dateStart, dateEnd } = parseMonthRange(month);
    const nominals = await this.buildAccountNominals(companyId, dateEnd);

    const accountRows = await this.db.db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name })
      .from(accounts)
      .where(eq(accounts.companyId, companyId));

    const accountByCode = new Map(accountRows.map((a) => [a.code, a]));

    const sections = DEFAULT_BALANCE_SHEET_TEMPLATE.map((sectionTpl) => {
      let sectionTotal = 0;

      const subsections = sectionTpl.subsections.map((subTpl) => {
        let subTotal = 0;

        const rows = subTpl.rows.map((rowTpl) => {
          const account = accountByCode.get(rowTpl.code);
          const name = account?.name ?? rowTpl.code;
          let amount: string | null = null;

          if (rowTpl.showNominal && account) {
            const nominal = nominals.get(account.id) ?? { debit: 0, credit: 0 };
            const net = (nominal.debit - nominal.credit) * subTpl.reverseCalculation;
            subTotal += net;
            sectionTotal += net;
            amount = net.toFixed(4);
          }

          return {
            code: rowTpl.code,
            name,
            level: rowTpl.level,
            amount,
          };
        });

        return {
          name: subTpl.name,
          reverseCalculation: subTpl.reverseCalculation,
          rows,
          total: subTotal.toFixed(4),
        };
      });

      return {
        name: sectionTpl.name,
        subsections,
        summaryLabel: sectionTpl.summaryLabel,
        summaryTotal: sectionTotal.toFixed(4),
      };
    });

    return { month, dateStart, dateEnd, sections };
  }

  /**
   * Saldo kumulatif per akun (debit/credit ter-rollup ke parent) sampai dateEnd.
   * Setara v1 BalanceSheetController::queryBalanceSheet + getTreeTotalNominal.
   */
  private async buildAccountNominals(
    companyId: bigint,
    dateEnd: string,
  ): Promise<Map<bigint, { debit: number; credit: number }>> {
    const accountRows = await this.db.db
      .select({
        id: accounts.id,
        parentId: accounts.parentId,
        level: accounts.level,
        isRetainedEarning: accounts.isRetainedEarning,
      })
      .from(accounts)
      .where(eq(accounts.companyId, companyId));

    const nominals = new Map<bigint, { debit: number; credit: number }>();
    for (const acc of accountRows) {
      nominals.set(acc.id, { debit: 0, credit: 0 });
    }

    const sums = await this.db.db
      .select({
        accountId: journalLines.accountId,
        totalDebit: sql<string>`COALESCE(SUM(${journalLines.debit}), 0)::text`.as('total_debit'),
        totalCredit: sql<string>`COALESCE(SUM(${journalLines.credit}), 0)::text`.as('total_credit'),
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
      .where(
        and(eq(journalLines.companyId, companyId), lte(journalEntries.transactionDate, dateEnd)),
      )
      .groupBy(journalLines.accountId);

    for (const row of sums) {
      nominals.set(row.accountId, {
        debit: Number(row.totalDebit),
        credit: Number(row.totalCredit),
      });
    }

    const lrpbAccount = accountRows.find((a) => a.isRetainedEarning);
    if (lrpbAccount) {
      const revenue = await this.sumCategoryTotals(companyId, REVENUE_CATEGORIES, {
        through: dateEnd,
      });
      const expense = await this.sumCategoryTotals(companyId, EXPENSE_CATEGORIES, {
        through: dateEnd,
      });

      const current = nominals.get(lrpbAccount.id)!;
      current.debit += Number(revenue.totalDebit) + Number(expense.totalDebit);
      current.credit += Number(revenue.totalCredit) + Number(expense.totalCredit);
    }

    const byLevel = [...accountRows].sort((a, b) => b.level - a.level);
    for (const acc of byLevel) {
      if (acc.parentId == null) continue;
      const child = nominals.get(acc.id);
      const parent = nominals.get(acc.parentId);
      if (!child || !parent) continue;
      parent.debit += child.debit;
      parent.credit += child.credit;
    }

    return nominals;
  }

  /**
   * saldo_pb — laba rugi kumulatif sebelum dateStart.
   * Setara v1: (pendapatan credit-debet) - (biaya debet-credit)
   */
  private async calculateRetainedEarningsBefore(
    companyId: bigint,
    dateStart: string,
  ): Promise<number> {
    const revenue = await this.sumCategoryTotals(companyId, REVENUE_CATEGORIES, {
      before: dateStart,
    });
    const expense = await this.sumCategoryTotals(companyId, EXPENSE_CATEGORIES, {
      before: dateStart,
    });

    const revenueNet = Number(revenue.totalCredit) - Number(revenue.totalDebit);
    const expenseNet = Number(expense.totalDebit) - Number(expense.totalCredit);
    return revenueNet - expenseNet;
  }

  /** saldo_pb_sekarang — laba rugi dalam rentang periode. */
  private async calculateRetainedEarningsInPeriod(
    companyId: bigint,
    dateStart: string,
    dateEnd: string,
  ): Promise<number> {
    const revenue = await this.sumCategoryTotals(companyId, REVENUE_CATEGORIES, {
      from: dateStart,
      to: dateEnd,
    });
    const expense = await this.sumCategoryTotals(companyId, EXPENSE_CATEGORIES, {
      from: dateStart,
      to: dateEnd,
    });

    const revenueNet = Number(revenue.totalCredit) - Number(revenue.totalDebit);
    const expenseNet = Number(expense.totalDebit) - Number(expense.totalCredit);
    return revenueNet - expenseNet;
  }

  private async sumCategoryTotals(
    companyId: bigint,
    categories: AccountCategory[],
    range: { before?: string; from?: string; to?: string; through?: string },
  ): Promise<{ totalDebit: string; totalCredit: string }> {
    const dateFilter =
      range.before != null
        ? lt(journalEntries.transactionDate, range.before)
        : range.through != null
          ? lte(journalEntries.transactionDate, range.through)
          : between(journalEntries.transactionDate, range.from!, range.to!);

    const [row] = await this.db.db
      .select({
        totalDebit: sql<string>`COALESCE(SUM(${journalLines.debit}), 0)::text`.as('total_debit'),
        totalCredit: sql<string>`COALESCE(SUM(${journalLines.credit}), 0)::text`.as('total_credit'),
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
      .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
      .where(
        and(
          eq(journalLines.companyId, companyId),
          inArray(accounts.category, categories),
          dateFilter,
        ),
      );

    return {
      totalDebit: row?.totalDebit ?? '0',
      totalCredit: row?.totalCredit ?? '0',
    };
  }
}

function parseMonthRange(month: string): { dateStart: string; dateEnd: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) {
    throw new Error(`Invalid month format "${month}", expected YYYY-MM`);
  }
  const year = Number(match[1]);
  const mon = Number(match[2]);
  if (mon < 1 || mon > 12) {
    throw new Error(`Invalid month "${month}"`);
  }
  const dateStart = `${match[1]}-${match[2]}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  const dateEnd = `${match[1]}-${match[2]}-${String(lastDay).padStart(2, '0')}`;
  return { dateStart, dateEnd };
}
