import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

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
}
