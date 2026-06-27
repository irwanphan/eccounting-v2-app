import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyMemberGuard } from '../../common/guards/company-member.guard';
import { JournalsService } from './journals.service';

@ApiTags('journals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyMemberGuard)
@Controller('companies/:companyId/journal-entries')
export class JournalsController {
  constructor(private readonly journals: JournalsService) {}

  @Get('grouped')
  @ApiOperation({
    summary: 'Daftar jurnal — mode Tampil (1 baris per posting/import)',
    description: 'Filter by tanggal pencatatan (posting_date), setara v1 group-journal Tampil',
  })
  @ApiQuery({ name: 'dateStart', required: true, example: '2023-08-01' })
  @ApiQuery({ name: 'dateEnd', required: true, example: '2026-06-30' })
  async listGrouped(
    @Param('companyId') companyId: string,
    @Query('dateStart') dateStart: string,
    @Query('dateEnd') dateEnd: string,
  ) {
    const data = await this.journals.listGrouped(BigInt(companyId), dateStart, dateEnd);
    return { data, meta: { total: data.length } };
  }

  @Get('detail')
  @ApiOperation({
    summary: 'Daftar jurnal — mode Detil (semua baris jurnal)',
    description: 'Filter by tanggal pencatatan (posting_date), setara v1 group-journal Detil',
  })
  @ApiQuery({ name: 'dateStart', required: true })
  @ApiQuery({ name: 'dateEnd', required: true })
  async listDetail(
    @Param('companyId') companyId: string,
    @Query('dateStart') dateStart: string,
    @Query('dateEnd') dateEnd: string,
  ) {
    const data = await this.journals.listDetail(BigInt(companyId), dateStart, dateEnd);
    return { data, meta: { total: data.length } };
  }

  @Get(':entryId/lines')
  @ApiOperation({ summary: 'Lihat detail baris 1 jurnal (modal Lihat)' })
  async getLines(
    @Param('companyId') companyId: string,
    @Param('entryId') entryId: string,
  ) {
    const result = await this.journals.getEntryLines(BigInt(companyId), BigInt(entryId));
    if (!result) return { entry: null, lines: [] };
    return {
      entry: {
        id: String(result.entry.id),
        postingNumber: result.entry.postingNumber,
        postingDate: result.entry.postingDate,
        description: result.entry.description,
      },
      lines: result.lines,
    };
  }
}
