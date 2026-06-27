import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { coaFormInputSchema } from '@eccounting/shared';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompanyMemberGuard } from '../../common/guards/company-member.guard';
import { AccountsService } from './accounts.service';

@ApiTags('accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyMemberGuard)
@Controller('companies/:companyId/accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get('tree')
  @ApiOperation({
    summary: 'Daftar kode akun hierarki',
    description: 'Tree + flat list, setara v1 CoaController::getCoaTreeAndSeq',
  })
  async getTree(@Param('companyId') companyId: string) {
    const data = await this.accounts.getTree(BigInt(companyId));
    return { data, meta: { total: data.flat.length } };
  }

  @Post()
  @ApiOperation({ summary: 'Buat kode akun baru' })
  async create(@Param('companyId') companyId: string, @Body() body: unknown) {
    const input = coaFormInputSchema.parse(body);
    const data = await this.accounts.create(BigInt(companyId), input);
    return {
      data,
      meta: { message: 'Kode akun berhasil disimpan.' },
    };
  }

  @Patch(':accountId')
  @ApiOperation({ summary: 'Perbarui kode akun' })
  async update(
    @Param('companyId') companyId: string,
    @Param('accountId') accountId: string,
    @Body() body: unknown,
  ) {
    const input = coaFormInputSchema.parse(body);
    const data = await this.accounts.update(BigInt(companyId), BigInt(accountId), input);
    return {
      data,
      meta: { message: 'Kode akun berhasil diperbaharui.' },
    };
  }

  @Delete(':accountId')
  @ApiOperation({ summary: 'Hapus kode akun' })
  async remove(
    @Param('companyId') companyId: string,
    @Param('accountId') accountId: string,
  ) {
    const data = await this.accounts.remove(BigInt(companyId), BigInt(accountId));
    return {
      data,
      meta: { message: 'Kode akun berhasil dihapus.' },
    };
  }
}
