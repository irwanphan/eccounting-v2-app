import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * Daftar nama queue. Tambahkan di sini untuk dipakai dengan
 * @InjectQueue() / @Processor().
 */
export const QUEUE_NAMES = {
  BALANCE_REFRESH: 'balance-refresh',
  EXCEL_IMPORT: 'excel-import',
  HARD_DELETE: 'hard-delete',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

@Global()
@Module({
  imports: [
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
  ],
  exports: [BullModule],
})
export class QueueModule {}
