import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { DbModule } from './infra/db/db.module';
import { BalanceRefreshProcessor } from './processors/balance-refresh.processor';
import { BalanceSnapshotScheduler } from './processors/balance-snapshot.scheduler';
import { ExcelImportProcessor } from './processors/excel-import.processor';
import { HardDeleteProcessor } from './processors/hard-delete.processor';
import { QUEUE_NAMES } from './queue/queue.constants';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.BALANCE_REFRESH },
      { name: QUEUE_NAMES.EXCEL_IMPORT },
      { name: QUEUE_NAMES.HARD_DELETE },
    ),
    DbModule,
  ],
  providers: [
    BalanceRefreshProcessor,
    ExcelImportProcessor,
    HardDeleteProcessor,
    BalanceSnapshotScheduler,
  ],
})
export class WorkerModule {}
