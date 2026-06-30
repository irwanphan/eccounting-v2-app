import { type ArgumentMetadata, BadRequestException, type PipeTransform } from '@nestjs/common';
import { type ZodSchema, ZodError } from 'zod';

function isZodError(error: unknown): error is ZodError {
  return (
    error instanceof ZodError ||
    (typeof error === 'object' &&
      error !== null &&
      'issues' in error &&
      Array.isArray((error as ZodError).issues))
  );
}

/**
 * Adapter Zod ke NestJS pipe. Pakai sebagai per-handler @UsePipes(new ZodValidationPipe(schema)).
 * Hanya memvalidasi @Body() — hindari validasi @Param / @CurrentUser() pada handler yang sama.
 */
export class ZodValidationPipe<T = unknown> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, metadata: ArgumentMetadata): T {
    if (metadata.type !== 'body') {
      return value as T;
    }

    try {
      return this.schema.parse(value);
    } catch (error) {
      if (isZodError(error)) {
        throw new BadRequestException({
          message: 'Validation failed',
          issues: error.issues.map((i) => ({
            path: i.path.join('.'),
            code: i.code,
            message: i.message,
          })),
        });
      }
      throw error;
    }
  }
}
