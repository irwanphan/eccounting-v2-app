import { type ExecutionContext, createParamDecorator } from '@nestjs/common';

export interface AuthUserContext {
  userId: bigint;
  firmId: bigint;
  email: string;
}

/**
 * Inject user yang terotentikasi (hasil JwtAuthGuard) ke handler.
 *
 * @example
 * ```ts
 * @Get('me')
 * me(@CurrentUser() user: AuthUserContext) { ... }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUserContext | undefined, ctx: ExecutionContext): unknown => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUserContext }>();
    if (!req.user) {
      throw new Error('CurrentUser: req.user belum di-set, pastikan endpoint diproteksi JwtAuthGuard');
    }
    return data ? req.user[data] : req.user;
  },
);
