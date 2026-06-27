import { accounts } from '@eccounting/db';
import { eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';

import { DbService } from '../../infra/db/db.service';

export interface ParsedImportLine {
  lineNo: number;
  transactionDate: string;
  accountId: string | null;
  accountCode: string;
  accountName: string | null;
  description: string | null;
  reference: string | null;
  debit: string;
  credit: string;
  warning: string | null;
}

const HEADER_ALIASES: Record<string, string[]> = {
  tanggal: ['tanggal', 'tgl', 'date', 'transaction_date'],
  kodeakun: ['kodeakun', 'kode akun', 'kode_akun', 'account_code', 'code'],
  keterangan: ['keterangan', 'desc', 'description', 'memo'],
  debet: ['debet', 'debit'],
  kredit: ['kredit', 'credit'],
  referensi: ['referensi', 'reference', 'ref'],
};

function normalizeHeader(value: ExcelJS.CellValue): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function resolveColumnMap(headerRow: ExcelJS.Row): Partial<Record<keyof typeof HEADER_ALIASES, number>> {
  const map: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {};
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const normalized = normalizeHeader(cell.value);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(normalized)) {
        map[field as keyof typeof HEADER_ALIASES] = colNumber;
      }
    }
  });
  return map;
}

function cellText(row: ExcelJS.Row, col?: number): string {
  if (!col) return '';
  return String(row.getCell(col).text ?? '').trim();
}

function parseAmount(raw: string): string {
  const cleaned = raw.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
  if (!cleaned || cleaned === '-' || cleaned === '.') return '0';
  const num = Number.parseFloat(cleaned);
  if (!Number.isFinite(num) || num < 0) return '0';
  return num.toFixed(4);
}

function parseDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const dmy = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

function isRowEmpty(row: ExcelJS.Row, cols: Partial<Record<keyof typeof HEADER_ALIASES, number>>): boolean {
  return (
    !cellText(row, cols.tanggal) &&
    !cellText(row, cols.kodeakun) &&
    !cellText(row, cols.keterangan) &&
    !cellText(row, cols.debet) &&
    !cellText(row, cols.kredit) &&
    !cellText(row, cols.referensi)
  );
}

export async function parseJournalImportFile(
  db: DbService,
  companyId: bigint,
  buffer: Buffer,
): Promise<ParsedImportLine[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error('File Excel tidak memiliki sheet.');
  }

  const headerRow = sheet.getRow(1);
  const cols = resolveColumnMap(headerRow);
  if (!cols.kodeakun) {
    throw new Error('Kolom kodeakun tidak ditemukan. Unduh template import terlebih dahulu.');
  }

  const accountRows = await db.withTenant(companyId, async (tx) =>
    tx
      .select({ id: accounts.id, code: accounts.code, name: accounts.name, isPostable: accounts.isPostable })
      .from(accounts)
      .where(eq(accounts.companyId, companyId)),
  );

  const accountByCode = new Map(accountRows.map((a) => [a.code, a]));

  const parsed: ParsedImportLine[] = [];
  let lineNo = 0;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    if (isRowEmpty(row, cols)) return;

    lineNo += 1;
    const accountCode = cellText(row, cols.kodeakun);
    const transactionDate = parseDate(cellText(row, cols.tanggal));
    const debit = parseAmount(cellText(row, cols.debet));
    const credit = parseAmount(cellText(row, cols.kredit));
    const account = accountByCode.get(accountCode);

    const warnings: string[] = [];
    if (!transactionDate) warnings.push('Tanggal tidak valid');
    if (!accountCode) warnings.push('Kode akun kosong');
    else if (!account) warnings.push(`Kode akun "${accountCode}" tidak ditemukan`);
    else if (!account.isPostable) warnings.push(`Akun "${accountCode}" bukan akun posting`);

    parsed.push({
      lineNo,
      transactionDate: transactionDate ?? new Date().toISOString().slice(0, 10),
      accountId: account ? String(account.id) : null,
      accountCode,
      accountName: account?.name ?? null,
      description: cellText(row, cols.keterangan) || null,
      reference: cellText(row, cols.referensi) || null,
      debit,
      credit,
      warning: warnings.length > 0 ? warnings.join('; ') : null,
    });
  });

  if (parsed.length === 0) {
    throw new Error('Excel tidak memiliki data. Silakan diisi terlebih dahulu.');
  }

  return parsed;
}
