import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { createJournalEntrySchema, type CreateJournalEntryInput } from '@eccounting/shared';
import type { FastifyRequest } from 'fastify';
import { Readable } from 'node:stream';

import { CurrentUser, type AuthUserContext } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyMemberGuard } from '../../common/guards/company-member.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
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

  @Get('import/template')
  @ApiOperation({ summary: 'Unduh template import jurnal (.xlsx)' })
  async downloadImportTemplate(): Promise<StreamableFile> {
    const { buffer, filename } = await this.journals.buildImportTemplate();
    return new StreamableFile(Readable.from(buffer), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Post('import/preview')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Parse file import Excel → baris draft jurnal (setara v1 import ke temp_journal)',
  })
  async previewImport(
    @Param('companyId') companyId: string,
    @Req() req: FastifyRequest,
  ): Promise<{ data: Awaited<ReturnType<JournalsService['parseImportPreview']>> }> {
    const file = await req.file();
    if (!file) {
      throw new BadRequestException('File import wajib diisi');
    }
    const buffer = await file.toBuffer();
    const data = await this.journals.parseImportPreview(BigInt(companyId), buffer);
    return { data };
  }

  @Post()
  @ApiOperation({ summary: 'Posting jurnal manual baru (setara v1 journal.store)' })
  @UsePipes(new ZodValidationPipe(createJournalEntrySchema))
  async create(
    @Param('companyId') companyId: string,
    @Body() body: CreateJournalEntryInput,
    @CurrentUser() user: AuthUserContext,
  ) {
    const result = await this.journals.createEntry(BigInt(companyId), user.userId, body);
    return { data: result };
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
