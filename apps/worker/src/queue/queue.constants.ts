/**
 * Duplikat dari apps/api/src/infra/queue/queue.module.ts.
 * Untuk MVP ini OK; bisa di-extract ke packages/shared kalau berkembang.
 */
export const QUEUE_NAMES = {
  BALANCE_REFRESH: 'balance-refresh',
  EXCEL_IMPORT: 'excel-import',
  HARD_DELETE: 'hard-delete',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
