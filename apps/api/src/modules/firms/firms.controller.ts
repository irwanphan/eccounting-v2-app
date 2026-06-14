import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, type AuthUserContext } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FirmsService } from './firms.service';

@ApiTags('firms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('firms')
export class FirmsController {
  constructor(private readonly firms: FirmsService) {}

  @Get('current')
  @ApiOperation({ summary: 'Detail firm dari user yang login' })
  async current(@CurrentUser() user: AuthUserContext): Promise<Record<string, unknown>> {
    const firm = await this.firms.getById(user.firmId);
    return this.firms.toDto(firm);
  }
}
