import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { DbModule } from './infra/db/db.module';
import { QueueModule } from './infra/queue/queue.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { FirmsModule } from './modules/firms/firms.module';
import { HealthModule } from './modules/health/health.module';
import { JournalsModule } from './modules/journals/journals.module';
import { ReportsModule } from './modules/reports/reports.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Monorepo: .env ada di repo root, bukan di apps/api
      envFilePath: ['../../.env', '.env', '.env.local'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    ScheduleModule.forRoot(),

    DbModule,
    QueueModule,

    // Modules
    UsersModule,
    AuthModule,
    FirmsModule,
    CompaniesModule,
    AccountsModule,
    JournalsModule,
    ReportsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
