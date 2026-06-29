import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type CreateUserInput,
  type UpdateUserInput,
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
