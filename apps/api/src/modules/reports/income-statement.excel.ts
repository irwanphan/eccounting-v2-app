import type { IncomeStatementBlock, IncomeStatementReport } from '@eccounting/shared';
import ExcelJS from 'exceljs';

export interface IncomeStatementExcelInput {
  report: IncomeStatementReport;
  companyName: string;
}

export async function buildIncomeStatementExcel(input: IncomeStatementExcelInput): Promise<Buffer> {
  const { report, companyName } = input;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Turbin - Eccounting';
  workbook.company = 'Hiu Ban Hin';
  workbook.title = 'Laba Rugi';
  workbook.description = 'Laporan laba rugi.';

  const sheet = workbook.addWorksheet('Laba Rugi');
  sheet.getColumn(1).width = 18;
  sheet.getColumn(2).width = 42;
  sheet.getColumn(3).width = 20;

  sheet.mergeCells('A1:C1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'Laporan Laba Rugi';
  titleCell.font = { bold: true, size: 18 };
  titleCell.alignment = { horizontal: 'center' };

  sheet.addRow([]);
  sheet.addRow(['Client', companyName]);
  sheet.addRow(['Periode', `${report.dateStart} sd ${report.dateEnd}`]);
  sheet.addRow([]);

  for (const block of report.blocks) {
    appendBlock(sheet, block);
  }

  sheet.getColumn(1).numFmt = '@';
  sheet.getColumn(3).numFmt = '#,##0.00';

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function incomeStatementExportFilename(dateStart: string, dateEnd: string): string {
  return `Laba Rugi (${dateStart} sd ${dateEnd}).xlsx`;
}

function appendBlock(sheet: ExcelJS.Worksheet, block: IncomeStatementBlock): void {
  if (block.kind === 'heading') {
    const row = sheet.addRow([block.label]);
    row.font = { bold: true, size: 14 };
    return;
  }

  if (block.kind === 'table') {
    const titleRow = sheet.addRow([block.title]);
    titleRow.font = { bold: true, size: 14 };

    const headerRow = sheet.addRow(['Kode Akun', 'Nama Akun', 'Nilai']);
    headerRow.font = { bold: true, size: 12 };
    headerRow.alignment = { horizontal: 'center' };

    const dataStart = sheet.rowCount + 1;
    for (const row of block.rows) {
      const dataRow = sheet.addRow([row.code, row.name, Number(row.amount)]);
      dataRow.getCell(1).numFmt = '@';
    }

    const totalRow = sheet.addRow(['', 'Total', Number(block.total)]);
    totalRow.getCell(3).font = { bold: true, size: 13 };

    if (block.rows.length > 0) {
      const borderEnd = sheet.rowCount;
      for (let rowNum = dataStart - 1; rowNum <= borderEnd; rowNum += 1) {
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

    sheet.addRow([]);
    return;
  }

  if (block.kind === 'summary') {
    const row = sheet.addRow([block.label, '', Number(block.amount)]);
    row.font = { bold: true, size: 15 };
    sheet.addRow([]);
  }
}
