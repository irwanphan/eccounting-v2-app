import { Injectable, NotFoundException } from '@nestjs/common';
import { accounts, companies, journalEntries, journalLines } from '@eccounting/db';
import type {
  AccountCategory,
  AccountOption,
  BalanceSheetReport,
  GeneralLedgerReport,
  IncomeStatementBlock,
  IncomeStatementReport,
  TrialBalanceReport,
} from '@eccounting/shared';
import { and, asc, between, eq, inArray, lte, lt, sql } from 'drizzle-orm';

import { DbService } from '../../infra/db/db.service';
import { DEFAULT_BALANCE_SHEET_TEMPLATE } from './balance-sheet.template';
import {
  INCOME_STATEMENT_LAYOUT,
  resolveV1IncomeCategory,
} from './income-statement.template';
import {
  buildIncomeStatementExcel,
  incomeStatementExportFilename,
} from './income-statement.excel';

/** Setara v1 CoaCategory::KELOMPOK['PENDAPATAN'] — category_id 1,2,3 */
const REVENUE_CATEGORIES: AccountCategory[] = ['REVENUE', 'OTHER_INCOME'];

/** Setara v1 CoaCategory::KELOMPOK['BIAYA'] — category_id 4,5,6,7,8 */
const EXPENSE_CATEGORIES: AccountCategory[] = ['COGS', 'EXPENSE', 'OTHER_EXPENSE', 'TAX_EXPENSE'];

const PL_CATEGORIES: AccountCategory[] = [...REVENUE_CATEGORIES, ...EXPENSE_CATEGORIES];

/** Akun neraca — saldo kumulatif (setara v1 category_id IS NULL) */
const BALANCE_SHEET_CATEGORIES: AccountCategory[] = ['ASSET', 'LIABILITY', 'EQUITY'];

interface AccountRow {
  id: bigint;
  parentId: bigint | null;
  code: string;
  name: string;
  level: number;
  normalBalance: 'D' | 'C';
  category: AccountCategory;
  isRetainedEarning: boolean;
}

interface AccountTreeNode extends AccountRow {
  children: AccountTreeNode[];
}

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

  async getTrialBalance(companyId: bigint, month: string): Promise<TrialBalanceReport> {
    const { dateStart, dateEnd } = parseMonthRange(month);
    const previousMonthEnd = endOfPreviousMonth(dateStart);

    const accountRows = await this.db.db
      .select({
        id: accounts.id,
        parentId: accounts.parentId,
        code: accounts.code,
        name: accounts.name,
        level: accounts.level,
        normalBalance: accounts.normalBalance,
        category: accounts.category,
        isRetainedEarning: accounts.isRetainedEarning,
      })
      .from(accounts)
      .where(eq(accounts.companyId, companyId))
      .orderBy(asc(accounts.code));

    const balances = new Map<bigint, { debit: number; credit: number }>();
    for (const acc of accountRows) {
      balances.set(acc.id, { debit: 0, credit: 0 });
    }

    const accountById = new Map(accountRows.map((a) => [a.id, a]));

    const cumulativeSums = await this.sumAccountsThroughDate(
      companyId,
      BALANCE_SHEET_CATEGORIES,
      dateEnd,
    );
    for (const row of cumulativeSums) {
      const account = accountById.get(row.accountId);
      if (!account) continue;
      this.applyTrialBalanceAmount(balances, account, row.totalDebit, row.totalCredit);
    }

    const lrpbAccount = accountRows.find((a) => a.isRetainedEarning);
    if (lrpbAccount) {
      const pendapatan = await this.sumCategoryTotals(companyId, REVENUE_CATEGORIES, {
        through: previousMonthEnd,
      });
      const biaya = await this.sumCategoryTotals(companyId, EXPENSE_CATEGORIES, {
        through: previousMonthEnd,
      });

      const entry = balances.get(lrpbAccount.id)!;
      if (lrpbAccount.normalBalance === 'D') {
        entry.debit +=
          Number(pendapatan.totalDebit) +
          Number(biaya.totalDebit) -
          (Number(pendapatan.totalCredit) + Number(biaya.totalCredit));
      } else {
        entry.credit +=
          Number(pendapatan.totalCredit) +
          Number(biaya.totalCredit) -
          (Number(pendapatan.totalDebit) + Number(biaya.totalDebit));
      }
    }

    const periodSums = await this.sumAccountsInPeriod(companyId, PL_CATEGORIES, dateStart, dateEnd);
    for (const row of periodSums) {
      const account = accountById.get(row.accountId);
      if (!account) continue;
      this.applyTrialBalanceAmount(balances, account, row.totalDebit, row.totalCredit);
    }

    const tree = buildAccountTree(accountRows);
    const rows = flattenAccountTree(tree, balances);

    let totalDebit = 0;
    let totalCredit = 0;
    for (const row of rows) {
      totalDebit += Number(row.debit);
      totalCredit += Number(row.credit);
    }

    return {
      month,
      dateStart,
      dateEnd,
      rows,
      totalDebit: totalDebit.toFixed(4),
      totalCredit: totalCredit.toFixed(4),
    };
  }

  /**
   * Laporan Laba Rugi — setara v1 LabaRugiController::queryLabaRugi + report.blade.php.
   * Filter rentang tanggal; nominal per akun = reverse × (debit − credit) dalam periode.
   */
  async getIncomeStatement(
    companyId: bigint,
    dateStart: string,
    dateEnd: string,
  ): Promise<IncomeStatementReport> {
    const accountRows = await this.db.db
      .select({
        id: accounts.id,
        code: accounts.code,
        name: accounts.name,
        level: accounts.level,
        category: accounts.category,
        subCategory: accounts.subCategory,
      })
      .from(accounts)
      .where(eq(accounts.companyId, companyId))
      .orderBy(asc(accounts.code));

    const periodSums = await this.sumAccountsInPeriod(
      companyId,
      PL_CATEGORIES,
      dateStart,
      dateEnd,
    );
    const sumByAccount = new Map(periodSums.map((row) => [row.accountId, row]));

    const rawByV1Category = new Map<
      number,
      Array<{ code: string; name: string; rawSelisih: number }>
    >();

    for (const account of accountRows) {
      if (account.level < 1) continue;

      const v1Category = resolveV1IncomeCategory({
        subCategory: account.subCategory,
        category: account.category,
        code: account.code,
      });
      if (v1Category == null) continue;

      const sums = sumByAccount.get(account.id);
      if (!sums) continue;

      const rawSelisih = sums.totalDebit - sums.totalCredit;
      if (rawSelisih === 0) continue;

      const bucket = rawByV1Category.get(v1Category) ?? [];
      bucket.push({
        code: account.code,
        name: account.name,
        rawSelisih,
      });
      rawByV1Category.set(v1Category, bucket);
    }

    const totals: Record<string, number> = {
      pendapatanUsaha: 0,
      hpp: 0,
      biayaUsaha: 0,
      pendapatanLain: 0,
      biayaLain: 0,
      pajak: 0,
    };

    const blocks: IncomeStatementBlock[] = [];

    for (const item of INCOME_STATEMENT_LAYOUT) {
      if (item.type === 'heading') {
        blocks.push({ kind: 'heading', label: item.label! });
        continue;
      }

      if (item.type === 'table' && item.table && item.totalKey) {
        const { title, v1Categories, reverseMultiplier } = item.table;
        const rows: Array<{ code: string; name: string; amount: string }> = [];
        let total = 0;

        for (const v1Cat of v1Categories) {
          const accountsInCat = rawByV1Category.get(v1Cat) ?? [];
          for (const acc of accountsInCat) {
            const nominal = reverseMultiplier * acc.rawSelisih;
            if (nominal === 0) continue;
            total += nominal;
            rows.push({
              code: acc.code,
              name: acc.name,
              amount: nominal.toFixed(4),
            });
          }
        }

        totals[item.totalKey] = total;
        blocks.push({
          kind: 'table',
          title,
          rows,
          total: total.toFixed(4),
        });
        continue;
      }

      if (item.type === 'summary' && item.compute) {
        const amount = item.compute(totals);
        blocks.push({
          kind: 'summary',
          label: item.label!,
          amount: amount.toFixed(4),
        });
      }
    }

    return { dateStart, dateEnd, blocks };
  }

  /** Setara v1 LabaRugiController::downloadExcel */
  async exportIncomeStatementExcel(
    companyId: bigint,
    dateStart: string,
    dateEnd: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const [company] = await this.db.db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      throw new NotFoundException('Perusahaan tidak ditemukan.');
    }

    const report = await this.getIncomeStatement(companyId, dateStart, dateEnd);
    const buffer = await buildIncomeStatementExcel({
      report,
      companyName: company.name,
    });

    return {
      buffer,
      filename: incomeStatementExportFilename(dateStart, dateEnd),
    };
  }

  /** Setara v1: debet normal → kolom debet, kredit normal → kolom kredit. */
  private applyTrialBalanceAmount(
    balances: Map<bigint, { debit: number; credit: number }>,
    account: Pick<AccountRow, 'id' | 'normalBalance'>,
    totalDebit: number,
    totalCredit: number,
  ): void {
    const entry = balances.get(account.id)!;
    if (account.normalBalance === 'D') {
      entry.debit += totalDebit - totalCredit;
    } else {
      entry.credit += totalCredit - totalDebit;
    }
  }

  private async sumAccountsThroughDate(
    companyId: bigint,
    categories: AccountCategory[],
    dateEnd: string,
  ): Promise<Array<{ accountId: bigint; totalDebit: number; totalCredit: number }>> {
    const rows = await this.db.db
      .select({
        accountId: journalLines.accountId,
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
          lte(journalEntries.transactionDate, dateEnd),
        ),
      )
      .groupBy(journalLines.accountId);

    return rows.map((r) => ({
      accountId: r.accountId,
      totalDebit: Number(r.totalDebit),
      totalCredit: Number(r.totalCredit),
    }));
  }

  private async sumAccountsInPeriod(
    companyId: bigint,
    categories: AccountCategory[],
    dateStart: string,
    dateEnd: string,
  ): Promise<Array<{ accountId: bigint; totalDebit: number; totalCredit: number }>> {
    const rows = await this.db.db
      .select({
        accountId: journalLines.accountId,
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
          between(journalEntries.transactionDate, dateStart, dateEnd),
        ),
      )
      .groupBy(journalLines.accountId);

    return rows.map((r) => ({
      accountId: r.accountId,
      totalDebit: Number(r.totalDebit),
      totalCredit: Number(r.totalCredit),
    }));
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

function endOfPreviousMonth(dateStart: string): string {
  const d = new Date(`${dateStart}T12:00:00`);
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildAccountTree(rows: AccountRow[]): AccountTreeNode[] {
  const nodes = new Map<bigint, AccountTreeNode>();
  for (const row of rows) {
    nodes.set(row.id, { ...row, children: [] });
  }

  const roots: AccountTreeNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentId != null && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (list: AccountTreeNode[]): void => {
    list.sort((a, b) => a.code.localeCompare(b.code));
    for (const n of list) sortNodes(n.children);
  };
  sortNodes(roots);
  return roots;
}

function flattenAccountTree(
  nodes: AccountTreeNode[],
  balances: Map<bigint, { debit: number; credit: number }>,
): TrialBalanceReport['rows'] {
  const rows: TrialBalanceReport['rows'] = [];

  const walk = (list: AccountTreeNode[]): void => {
    for (const node of list) {
      const bal = balances.get(node.id) ?? { debit: 0, credit: 0 };
      rows.push({
        id: String(node.id),
        code: node.code,
        name: node.name,
        level: node.level,
        debit: bal.debit.toFixed(4),
        credit: bal.credit.toFixed(4),
      });
      if (node.children.length > 0) walk(node.children);
    }
  };

  walk(nodes);
  return rows;
}
