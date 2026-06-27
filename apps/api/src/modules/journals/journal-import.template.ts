import ExcelJS from 'exceljs';

export async function buildJournalImportTemplateBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Import');

  sheet.columns = [
    { header: 'tanggal', key: 'tanggal', width: 14 },
    { header: 'kodeakun', key: 'kodeakun', width: 16 },
    { header: 'referensi', key: 'referensi', width: 18 },
    { header: 'keterangan', key: 'keterangan', width: 32 },
    { header: 'debet', key: 'debet', width: 14 },
    { header: 'kredit', key: 'kredit', width: 14 },
  ];

  sheet.getRow(1).font = { bold: true };

  sheet.addRow({
    tanggal: '01/06/2026',
    kodeakun: '1110-001',
    referensi: 'REF-001',
    keterangan: 'Contoh baris debet',
    debet: 1000000,
    kredit: 0,
  });
  sheet.addRow({
    tanggal: '01/06/2026',
    kodeakun: '4110-001',
    referensi: 'REF-001',
    keterangan: 'Contoh baris kredit',
    debet: 0,
    kredit: 1000000,
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
