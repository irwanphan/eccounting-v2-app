import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import {
  type ApiErrorBody,
  BusinessError,
  ErrorCode,
  parseDatabaseError,
} from '@eccounting/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';

@Catch()
export class BusinessExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(BusinessExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const requestId = (request.headers['x-request-id'] as string | undefined) ?? undefined;

    if (exception instanceof BusinessError) {
      const body: ApiErrorBody = {
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
          requestId,
        },
      };
      void response.status(exception.httpStatus).send(body);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message = typeof res === 'string' ? res : (res as { message?: string }).message;
      const body: ApiErrorBody = {
        error: {
          code: ErrorCode.VALIDATION_FAILED,
          message: message ?? exception.message,
          details: typeof res === 'object' ? res : undefined,
          requestId,
        },
      };
      void response.status(status).send(body);
      return;
    }

    // PostgreSQL error (lewat pg / drizzle) — parse format 'CODE: pesan'
    const dbErr = exception as { code?: string; message?: string; detail?: string };
    if (dbErr?.message) {
      const parsed = parseDatabaseError(dbErr.message);
      if (parsed) {
        const body: ApiErrorBody = {
          error: { code: parsed.code, message: parsed.message, requestId },
        };
        void response.status(422).send(body);
        return;
      }
    }

    this.logger.error('Unhandled exception', exception);
    const body: ApiErrorBody = {
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
        requestId,
      },
    };
    void response.status(500).send(body);
  }
}
