/** Template neraca default — setara v1 bs_default + ImportBalanceSheetReportStructure.csv */

export interface BalanceSheetTemplateRow {
  code: string;
  level: number;
  showNominal: boolean;
}

export interface BalanceSheetTemplateSubsection {
  name: string;
  reverseCalculation: 1 | -1;
  rows: BalanceSheetTemplateRow[];
}

export interface BalanceSheetTemplateSection {
  name: string;
  subsections: BalanceSheetTemplateSubsection[];
  summaryLabel: string;
}

export const DEFAULT_BALANCE_SHEET_TEMPLATE: BalanceSheetTemplateSection[] = [
  {
    name: 'Aktiva',
    summaryLabel: 'Total Aktiva',
    subsections: [
      {
        name: 'Aktiva Lancar',
        reverseCalculation: 1,
        rows: [
          { code: '1000-000', level: 1, showNominal: false },
          { code: '1100-000', level: 2, showNominal: false },
          { code: '1110-000', level: 3, showNominal: true },
          { code: '1120-000', level: 3, showNominal: true },
          { code: '1130-000', level: 3, showNominal: true },
          { code: '1140-000', level: 3, showNominal: true },
          { code: '1150-000', level: 3, showNominal: true },
          { code: '1160-000', level: 3, showNominal: true },
        ],
      },
      {
        name: 'Aktiva Lain-Lain',
        reverseCalculation: 1,
        rows: [
          { code: '1000-000', level: 1, showNominal: false },
          { code: '1200-000', level: 2, showNominal: false },
          { code: '1210-000', level: 3, showNominal: true },
          { code: '1220-000', level: 3, showNominal: true },
          { code: '1230-000', level: 3, showNominal: true },
          { code: '1240-000', level: 3, showNominal: true },
          { code: '1250-000', level: 3, showNominal: true },
        ],
      },
      {
        name: 'Aktiva Tetap',
        reverseCalculation: 1,
        rows: [
          { code: '1000-000', level: 1, showNominal: false },
          { code: '1300-000', level: 2, showNominal: false },
          { code: '1310-000', level: 3, showNominal: true },
        ],
      },
    ],
  },
  {
    name: 'Pasiva',
    summaryLabel: 'Total Pasiva',
    subsections: [
      {
        name: 'Hutang Lancar',
        reverseCalculation: -1,
        rows: [
          { code: '2000-000', level: 1, showNominal: false },
          { code: '2100-000', level: 2, showNominal: false },
          { code: '2110-000', level: 3, showNominal: true },
          { code: '2120-000', level: 3, showNominal: true },
          { code: '2130-000', level: 3, showNominal: true },
        ],
      },
      {
        name: 'Hutang Jangka Panjang',
        reverseCalculation: -1,
        rows: [
          { code: '2000-000', level: 1, showNominal: false },
          { code: '2200-000', level: 2, showNominal: true },
        ],
      },
      {
        name: 'Modal',
        reverseCalculation: -1,
        rows: [
          { code: '3000-000', level: 1, showNominal: false },
          { code: '3100-000', level: 2, showNominal: false },
          { code: '3110-000', level: 3, showNominal: true },
          { code: '3120-000', level: 3, showNominal: true },
        ],
      },
    ],
  },
];
