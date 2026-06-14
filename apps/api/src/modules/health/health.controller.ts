import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { DbService } from '../../infra/db/db.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly dbService: DbService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe — API alive' })
  liveness(): { status: 'ok'; service: string; version: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'eccounting-api',
      version: process.env.npm_package_version ?? '0.0.0',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — semua dependency siap (DB, dll)' })
  async readiness(): Promise<{ status: 'ok' | 'degraded'; checks: Record<string, boolean> }> {
    const checks = {
      database: await this.dbService.ping().catch(() => false),
    };
    const allOk = Object.values(checks).every(Boolean);
    return { status: allOk ? 'ok' : 'degraded', checks };
  }
}
