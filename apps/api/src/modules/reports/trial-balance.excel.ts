import type { TrialBalanceReport } from '@eccounting/shared';
import ExcelJS from 'exceljs';

export interface TrialBalanceExcelInput {
  report: TrialBalanceReport;
  companyName: string;
}

export async function buildTrialBalanceExcel(input: TrialBalanceExcelInput): Promise<Buffer> {
  const { report, companyName } = input;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Turbin - Eccounting';
  workbook.company = 'Hiu Ban Hin';
  workbook.title = 'Neraca Saldo';
  workbook.description = 'Export neraca saldo.';

  const sheet = workbook.addWorksheet('Neraca Saldo');
  sheet.getColumn(1).width = 18;
  sheet.getColumn(2).width = 42;
  sheet.getColumn(3).width = 18;
  sheet.getColumn(4).width = 18;

  sheet.mergeCells('A1:D1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'Neraca Saldo';
  titleCell.font = { bold: true, size: 20 };
  titleCell.alignment = { horizontal: 'center' };

  sheet.addRow([]);
  sheet.addRow(['Client', companyName]);
  sheet.addRow(['Periode', report.month]);
  sheet.addRow([]);

  const headerRow = sheet.addRow(['Kode', 'Nama', 'Debet', 'Kredit']);
  headerRow.font = { bold: true, size: 12 };
  headerRow.alignment = { horizontal: 'center' };

  const dataStart = sheet.rowCount + 1;
  for (const row of report.rows) {
    const debit = Number(row.debit);
    const credit = Number(row.credit);
    const dataRow = sheet.addRow([
      row.code,
      row.name,
      debit !== 0 ? debit : null,
      credit !== 0 ? credit : null,
    ]);
    dataRow.getCell(1).numFmt = '@';
  }

  const totalRow = sheet.addRow([
    '',
    '',
    Number(report.totalDebit),
    Number(report.totalCredit),
  ]);
  totalRow.font = { bold: true, size: 13 };

  if (report.rows.length > 0) {
    for (let rowNum = dataStart - 1; rowNum <= sheet.rowCount; rowNum += 1) {
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

  sheet.getColumn(1).numFmt = '@';
  sheet.getColumn(3).numFmt = '#,##0.00';
  sheet.getColumn(4).numFmt = '#,##0.00';

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function trialBalanceExportFilename(month: string): string {
  return `Neraca Saldo (${month}).xlsx`;
}
