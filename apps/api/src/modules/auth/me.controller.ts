import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { companyMembers, companies, users } from '@eccounting/db';
import type { CurrentUserResponse } from '@eccounting/shared';
import { eq } from 'drizzle-orm';

import { CurrentUser, type AuthUserContext } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DbService } from '../../infra/db/db.service';

@ApiTags('auth')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('auth/me')
export class MeController {
  constructor(private readonly db: DbService) {}

  @Get()
  @ApiOperation({ summary: 'Get profile + memberships user yang login' })
  async me(@CurrentUser() user: AuthUserContext): Promise<CurrentUserResponse> {
    const [profile] = await this.db.db
      .select({
        id: users.id,
        firmId: users.firmId,
        email: users.email,
        name: users.name,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        passwordChangedAt: users.passwordChangedAt,
      })
      .from(users)
      .where(eq(users.id, user.userId))
      .limit(1);

    if (!profile) throw new Error('User tidak ditemukan');

    const memberships = await this.db.db
      .select({
        companyId: companyMembers.companyId,
        companyName: companies.name,
        role: companyMembers.role,
      })
      .from(companyMembers)
      .innerJoin(companies, eq(companies.id, companyMembers.companyId))
      .where(eq(companyMembers.userId, user.userId));

    return {
      id: String(profile.id),
      firmId: String(profile.firmId),
      email: profile.email,
      name: profile.name,
      isActive: profile.isActive,
      lastLoginAt: profile.lastLoginAt ? profile.lastLoginAt.toISOString() : null,
      passwordChangedAt: profile.passwordChangedAt.toISOString(),
      memberships: memberships.map((m) => ({
        companyId: String(m.companyId),
        companyName: m.companyName,
        role: m.role as 'owner' | 'accountant' | 'viewer',
      })),
    };
  }
}
