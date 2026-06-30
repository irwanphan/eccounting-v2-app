import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AddAllUserMembershipsInput,
  type CreateUserInput,
  type UpdateUserInput,
  addAllUserMembershipsSchema,
  createUserSchema,
  updateUserSchema,
} from '@eccounting/shared';

import { CurrentUser, type AuthUserContext } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar pengguna di firm (setara v1 voyager.users.index)' })
  async list(@CurrentUser() user: AuthUserContext) {
    const data = await this.users.listForFirm(user.firmId);
    return { data, meta: { total: data.length } };
  }

  @Get(':id/memberships')
  @ApiOperation({ summary: 'Akses klien per pengguna (ganti v1 role assignment per client)' })
  async memberships(@Param('id') id: string, @CurrentUser() user: AuthUserContext) {
    const data = await this.users.listMemberships(BigInt(id), user.firmId);
    return { data };
  }

  @Post(':id/memberships/add-all')
  @ApiOperation({ summary: 'Tambah akses ke semua klien aktif di firm' })
  @UsePipes(new ZodValidationPipe(addAllUserMembershipsSchema))
  async addAllMemberships(
    @Param('id') id: string,
    @Body() body: AddAllUserMembershipsInput,
    @CurrentUser() user: AuthUserContext,
  ) {
    const result = await this.users.addAllMemberships(BigInt(id), user.firmId, body.role);
    return { data: result };
  }

  @Delete(':id/memberships')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hapus semua akses klien pengguna di firm' })
  async removeAllMemberships(@Param('id') id: string, @CurrentUser() user: AuthUserContext) {
    const result = await this.users.removeAllMemberships(BigInt(id), user.firmId);
    return { data: result };
  }

  @Post()
  @ApiOperation({ summary: 'Buat pengguna baru (setara v1 users.create)' })
  @UsePipes(new ZodValidationPipe(createUserSchema))
  async create(@Body() body: CreateUserInput, @CurrentUser() user: AuthUserContext) {
    const created = await this.users.create(body, user.firmId);
    return { data: created };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ubah pengguna / reset password / nonaktifkan' })
  @UsePipes(new ZodValidationPipe(updateUserSchema))
  async update(
    @Param('id') id: string,
    @Body() body: UpdateUserInput,
    @CurrentUser() user: AuthUserContext,
  ) {
    const updated = await this.users.update(BigInt(id), user.firmId, user.userId, body);
    return { data: updated };
  }
}
