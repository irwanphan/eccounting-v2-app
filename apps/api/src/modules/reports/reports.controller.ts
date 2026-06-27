import { Controller, Get, Param, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Readable } from 'node:stream';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyMemberGuard } from '../../common/guards/company-member.guard';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyMemberGuard)
@Controller('companies/:companyId/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('accounts')
  @ApiOperation({ summary: 'Daftar akun postable untuk select COA (Buku Besar, dll.)' })
  async listAccounts(@Param('companyId') companyId: string) {
    const data = await this.reports.listAccountOptions(BigInt(companyId));
    return { data, meta: { total: data.length } };
  }

  @Get('general-ledger')
  @ApiOperation({
    summary: 'Laporan Buku Besar per akun',
    description: 'Filter by transaction_date, setara v1 ledger.getData',
  })
  @ApiQuery({ name: 'accountId', required: true })
  @ApiQuery({ name: 'dateStart', required: true, example: '2023-06-01' })
  @ApiQuery({ name: 'dateEnd', required: true, example: '2023-06-30' })
  async generalLedger(
    @Param('companyId') companyId: string,
    @Query('accountId') accountId: string,
    @Query('dateStart') dateStart: string,
    @Query('dateEnd') dateEnd: string,
  ) {
    const data = await this.reports.getGeneralLedger(
      BigInt(companyId),
      BigInt(accountId),
      dateStart,
      dateEnd,
    );
    if (!data) return { data: null };
    return { data };
  }

  @Get('balance-sheet')
  @ApiOperation({
    summary: 'Laporan Neraca',
    description: 'Filter per bulan (YYYY-MM), setara v1 balance-sheet.getData',
  })
  @ApiQuery({ name: 'month', required: true, example: '2025-01' })
  async balanceSheet(@Param('companyId') companyId: string, @Query('month') month: string) {
    const data = await this.reports.getBalanceSheet(BigInt(companyId), month);
    return { data };
  }

  @Get('trial-balance')
  @ApiOperation({
    summary: 'Laporan Neraca Saldo',
    description: 'Filter per bulan (YYYY-MM), setara v1 balance.getData',
  })
  @ApiQuery({ name: 'month', required: true, example: '2025-01' })
  async trialBalance(@Param('companyId') companyId: string, @Query('month') month: string) {
    const data = await this.reports.getTrialBalance(BigInt(companyId), month);
    return { data };
  }

  @Get('trial-balance/export')
  @ApiOperation({
    summary: 'Export Neraca Saldo ke Excel',
    description: 'Setara v1 financial-report.balance.download-excel',
  })
  @ApiQuery({ name: 'month', required: true, example: '2025-01' })
  async exportTrialBalance(
    @Param('companyId') companyId: string,
    @Query('month') month: string,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.reports.exportTrialBalanceExcel(
      BigInt(companyId),
      month,
    );

    return new StreamableFile(Readable.from(buffer), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get('income-statement')
  @ApiOperation({
    summary: 'Laporan Laba Rugi',
    description: 'Filter rentang tanggal, setara v1 laba-rugi.detail_labarugi',
  })
  @ApiQuery({ name: 'dateStart', required: true, example: '2022-06-01' })
  @ApiQuery({ name: 'dateEnd', required: true, example: '2026-06-30' })
  async incomeStatement(
    @Param('companyId') companyId: string,
    @Query('dateStart') dateStart: string,
    @Query('dateEnd') dateEnd: string,
  ) {
    const data = await this.reports.getIncomeStatement(BigInt(companyId), dateStart, dateEnd);
    return { data };
  }

  @Get('income-statement/export')
  @ApiOperation({
    summary: 'Export Laporan Laba Rugi ke Excel',
    description: 'Setara v1 financial-report.laba-rugi.download-excel',
  })
  @ApiQuery({ name: 'dateStart', required: true, example: '2022-06-01' })
  @ApiQuery({ name: 'dateEnd', required: true, example: '2026-06-30' })
  async exportIncomeStatement(
    @Param('companyId') companyId: string,
    @Query('dateStart') dateStart: string,
    @Query('dateEnd') dateEnd: string,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.reports.exportIncomeStatementExcel(
      BigInt(companyId),
      dateStart,
      dateEnd,
    );

    return new StreamableFile(Readable.from(buffer), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
