import type { BalanceSheetReport } from '@eccounting/shared';
import ExcelJS from 'exceljs';

export interface BalanceSheetExcelInput {
  report: BalanceSheetReport;
  companyName: string;
}

export async function buildBalanceSheetExcel(input: BalanceSheetExcelInput): Promise<Buffer> {
  const { report, companyName } = input;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Turbin - Eccounting';
  workbook.company = 'Hiu Ban Hin';
  workbook.title = 'Neraca';
  workbook.description = 'Export neraca.';

  const sheet = workbook.addWorksheet('Neraca');
  sheet.getColumn(1).width = 18;
  sheet.getColumn(2).width = 42;
  sheet.getColumn(3).width = 20;

  sheet.mergeCells('A1:C1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'Neraca';
  titleCell.font = { bold: true, size: 20 };
  titleCell.alignment = { horizontal: 'center' };

  sheet.addRow([]);
  sheet.addRow(['Client', companyName]);
  sheet.addRow(['Periode', `${report.dateStart} sd ${report.dateEnd}`]);
  sheet.addRow([]);

  for (const section of report.sections) {
    const sectionRow = sheet.addRow([section.name]);
    sectionRow.font = { bold: true, size: 14 };

    for (const sub of section.subsections) {
      const subTitleRow = sheet.addRow([sub.name]);
      subTitleRow.font = { bold: true, size: 13 };

      const headerRow = sheet.addRow(['Kode Akun', 'Nama Akun', 'Nilai']);
      headerRow.font = { bold: true, size: 12 };
      headerRow.alignment = { horizontal: 'center' };

      const tableStart = sheet.rowCount + 1;
      for (const row of sub.rows) {
        const amount = row.amount != null ? Number(row.amount) : null;
        const dataRow = sheet.addRow([row.code, row.name, amount ?? '']);
        dataRow.getCell(1).numFmt = '@';
      }

      const totalRow = sheet.addRow(['', 'Total', Number(sub.total)]);
      totalRow.getCell(3).font = { bold: true, size: 13 };

      applyTableBorder(sheet, tableStart - 1, sheet.rowCount);
    }

    const summaryRow = sheet.addRow(['', section.summaryLabel, Number(section.summaryTotal)]);
    summaryRow.font = { bold: true, size: 15 };
    sheet.addRow([]);
  }

  sheet.getColumn(1).numFmt = '@';
  sheet.getColumn(3).numFmt = '#,##0.00';

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function balanceSheetExportFilename(dateStart: string, dateEnd: string): string {
  return `Neraca (${dateStart} sd ${dateEnd}).xlsx`;
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
