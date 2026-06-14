import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  type AddCompanyMemberInput,
  type CreateCompanyInput,
  addCompanyMemberSchema,
  createCompanySchema,
} from '@eccounting/shared';

import { CurrentUser, type AuthUserContext } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CompaniesService } from './companies.service';

@ApiTags('companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  @ApiOperation({ summary: 'List companies (default: yang user jadi member-nya)' })
  @ApiQuery({ name: 'all', required: false, type: Boolean, description: 'Admin only — semua company di firm' })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  async list(
    @CurrentUser() user: AuthUserContext,
    @Query('all') all?: string,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<Array<Record<string, unknown>>> {
    const wantsAll = all === 'true' || all === '1';
    const rows = wantsAll
      ? await this.companies.listForFirm(user.firmId, includeArchived === 'true')
      : await this.companies.listForUser(user.userId, user.firmId);
    return rows.map((c) => this.companies.toDto(c));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail company' })
  async get(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserContext,
  ): Promise<Record<string, unknown>> {
    const company = await this.companies.getById(BigInt(id), user.firmId);
    return this.companies.toDto(company);
  }

  @Post()
  @ApiOperation({
    summary: 'Create company (pembukuan klien baru)',
    description: 'Otomatis seed COA default + accounting periods + jadikan creator sebagai owner',
  })
  @UsePipes(new ZodValidationPipe(createCompanySchema))
  async create(
    @Body() body: CreateCompanyInput,
    @CurrentUser() user: AuthUserContext,
  ): Promise<Record<string, unknown>> {
    const company = await this.companies.create(body, {
      userId: user.userId,
      firmId: user.firmId,
    });
    return this.companies.toDto(company);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Tambah/update member dengan role' })
  @UsePipes(new ZodValidationPipe(addCompanyMemberSchema))
  async addMember(
    @Param('id') id: string,
    @Body() body: AddCompanyMemberInput,
  ): Promise<Record<string, unknown>> {
    const member = await this.companies.addMember(
      BigInt(id),
      BigInt(body.userId),
      body.role,
    );
    return {
      companyId: String(member.companyId),
      userId: String(member.userId),
      role: member.role,
      createdAt: member.createdAt.toISOString(),
    };
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hapus membership' })
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    await this.companies.removeMember(BigInt(id), BigInt(userId));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive company (soft delete)' })
  async archive(@Param('id') id: string, @CurrentUser() user: AuthUserContext): Promise<void> {
    await this.companies.archive(BigInt(id), user.firmId);
  }
}
