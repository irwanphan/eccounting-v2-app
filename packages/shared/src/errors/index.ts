/**
 * Domain error codes — string konsisten yang dipakai antara backend dan frontend.
 * Backend RAISE EXCEPTION '<CODE>: msg' lalu mapper translate ke business error class.
 * Frontend tau bagaimana display error berdasarkan code (i18n, action button, dll).
 */
export const ErrorCode = {
  // auth
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_INSUFFICIENT_ROLE: 'AUTH_INSUFFICIENT_ROLE',
  AUTH_NOT_COMPANY_MEMBER: 'AUTH_NOT_COMPANY_MEMBER',

  // company
  COMPANY_NOT_FOUND: 'COMPANY_NOT_FOUND',
  COMPANY_ARCHIVED: 'COMPANY_ARCHIVED',

  // account / COA
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  ACCOUNT_NOT_POSTABLE: 'ACCOUNT_NOT_POSTABLE',
  ACCOUNT_ARCHIVED: 'ACCOUNT_ARCHIVED',
  ACCOUNT_WRONG_TENANT: 'ACCOUNT_WRONG_TENANT',
  ACCOUNT_CODE_DUPLICATE: 'ACCOUNT_CODE_DUPLICATE',
  ACCOUNT_HAS_TRANSACTIONS: 'ACCOUNT_HAS_TRANSACTIONS',

  // period
  PERIOD_NOT_FOUND: 'PERIOD_NOT_FOUND',
  PERIOD_NOT_OPEN: 'PERIOD_NOT_OPEN',
  PERIOD_ALREADY_CLOSED: 'PERIOD_ALREADY_CLOSED',
  PERIOD_LOCKED: 'PERIOD_LOCKED',

  // journal
  JOURNAL_UNBALANCED: 'JOURNAL_UNBALANCED',
  JOURNAL_INSUFFICIENT_LINES: 'JOURNAL_INSUFFICIENT_LINES',
  JOURNAL_ZERO_AMOUNT: 'JOURNAL_ZERO_AMOUNT',
  JOURNAL_IMMUTABLE: 'JOURNAL_IMMUTABLE',
  JOURNAL_ALREADY_REVERSED: 'JOURNAL_ALREADY_REVERSED',
  POSTING_NUMBER_CONFLICT: 'POSTING_NUMBER_CONFLICT',

  // import
  IMPORT_DUPLICATE_FILE: 'IMPORT_DUPLICATE_FILE',
  IMPORT_INVALID_FORMAT: 'IMPORT_INVALID_FORMAT',
  IMPORT_BATCH_NOT_FOUND: 'IMPORT_BATCH_NOT_FOUND',

  // generic
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeKey = keyof typeof ErrorCode;
export type ErrorCodeValue = (typeof ErrorCode)[ErrorCodeKey];

export interface ApiErrorBody {
  error: {
    code: ErrorCodeValue;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export class BusinessError extends Error {
  constructor(
    public readonly code: ErrorCodeValue,
    message: string,
    public readonly details?: unknown,
    public readonly httpStatus: number = 422,
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}

export class NotFoundError extends BusinessError {
  constructor(code: ErrorCodeValue, message: string, details?: unknown) {
    super(code, message, details, 404);
    this.name = 'NotFoundError';
  }
}

export class AuthError extends BusinessError {
  constructor(code: ErrorCodeValue, message: string, details?: unknown) {
    super(code, message, details, 401);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends BusinessError {
  constructor(code: ErrorCodeValue, message: string, details?: unknown) {
    super(code, message, details, 403);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends BusinessError {
  constructor(code: ErrorCodeValue, message: string, details?: unknown) {
    super(code, message, details, 409);
    this.name = 'ConflictError';
  }
}

/**
 * Parse PostgreSQL error message yang di-RAISE oleh trigger function dengan format:
 *   'CODE_NAME: pesan deskriptif'
 *
 * Return null kalau bukan format yang dikenali.
 */
export function parseDatabaseError(rawMessage: string): { code: ErrorCodeValue; message: string } | null {
  const match = rawMessage.match(/^([A-Z_]+):\s*(.+)$/);
  if (!match) return null;
  const [, code, message] = match;
  if (!code || !message) return null;
  if (Object.values(ErrorCode).includes(code as ErrorCodeValue)) {
    return { code: code as ErrorCodeValue, message };
  }
  return null;
}
