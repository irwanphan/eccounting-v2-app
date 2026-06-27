import type { GeneralLedgerReport } from '@eccounting/shared';
import ExcelJS from 'exceljs';

export interface GeneralLedgerExcelInput {
  report: GeneralLedgerReport;
  companyName: string;
}

function formatExcelDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export async function buildGeneralLedgerExcel(input: GeneralLedgerExcelInput): Promise<Buffer> {
  const { report, companyName } = input;
  const { account, dateStart, dateEnd } = report;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Turbin - Eccounting';
  workbook.company = 'Hiu Ban Hin';
  workbook.title = `Buku Besar ${account.code}`;
  workbook.description = `Laporan Buku Besar ${account.code}`;

  const sheetName = `Buku Besar (${account.code})`.slice(0, 31);
  const sheet = workbook.addWorksheet(sheetName);

  sheet.getColumn(1).width = 6;
  sheet.getColumn(2).width = 14;
  sheet.getColumn(3).width = 16;
  sheet.getColumn(4).width = 16;
  sheet.getColumn(5).width = 36;
  sheet.getColumn(6).width = 18;
  sheet.getColumn(7).width = 18;

  sheet.mergeCells('A1:G1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `LAPORAN BUKU BESAR (${account.code} ${account.name.toUpperCase()})`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center' };

  sheet.mergeCells('A2:G2');
  const periodCell = sheet.getCell('A2');
  periodCell.value = `(${dateStart} s/d ${dateEnd})`;
  periodCell.font = { bold: true, size: 11 };
  periodCell.alignment = { horizontal: 'center' };

  sheet.addRow([]);
  sheet.addRow(['Client', companyName]);
  sheet.addRow([]);

  const headerRow = sheet.addRow([
    'No',
    'Tgl',
    'No. Form',
    'Referensi',
    'Keterangan',
    'Nilai',
    'Saldo',
  ]);
  headerRow.font = { bold: true, size: 11 };
  headerRow.alignment = { horizontal: 'center' };

  const tableStart = sheet.rowCount + 1;

  const openingRow = sheet.addRow(['', '', '', '', 'Saldo Awal', '', Number(report.openingBalance)]);
  openingRow.getCell(5).font = { bold: true };
  openingRow.getCell(7).numFmt = '#,##0.00';

  for (const line of report.lines) {
    const row = sheet.addRow([
      line.lineNo,
      formatExcelDate(line.transactionDate),
      line.postingNumber,
      line.reference ?? '',
      line.description ?? '',
      Number(line.amount),
      Number(line.balance),
    ]);
    row.getCell(6).numFmt = '#,##0.00';
    row.getCell(7).numFmt = '#,##0.00';
  }

  if (report.retainedEarningsInPeriod != null) {
    const lrpbRow = sheet.addRow([
      '',
      '',
      '',
      '',
      `Laba Rugi Periode Berjalan ( ${formatExcelDate(dateStart)} s/d ${formatExcelDate(dateEnd)} )`,
      '',
      Number(report.retainedEarningsInPeriod),
    ]);
    lrpbRow.getCell(5).font = { bold: true };
    lrpbRow.getCell(7).numFmt = '#,##0.00';
  }

  const closingRow = sheet.addRow(['', '', '', '', 'Saldo Akhir', '', Number(report.closingBalance)]);
  closingRow.getCell(5).font = { bold: true };
  closingRow.getCell(7).numFmt = '#,##0.00';

  applyTableBorder(sheet, tableStart - 1, sheet.rowCount);
  sheet.getColumn(6).numFmt = '#,##0.00';
  sheet.getColumn(7).numFmt = '#,##0.00';

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function generalLedgerExportFilename(report: GeneralLedgerReport): string {
  const { account, dateStart, dateEnd } = report;
  return `Buku Besar (${account.code}-${account.name}) ${dateStart} sd ${dateEnd}.xlsx`;
}

function applyTableBorder(sheet: ExcelJS.Worksheet, startRow: number, endRow: number): void {
  for (let rowNum = startRow; rowNum <= endRow; rowNum += 1) {
    const row = sheet.getRow(rowNum);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  }
}
