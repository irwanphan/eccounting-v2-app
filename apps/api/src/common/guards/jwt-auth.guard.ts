import { type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { AuthError, ErrorCode } from '@eccounting/shared';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context) as boolean | Promise<boolean>;
  }

  handleRequest<TUser>(err: unknown, user: TUser | false, info: { message?: string } | undefined): TUser {
    if (err || !user) {
      const msg = info?.message ?? 'Token tidak valid';
      if (msg.toLowerCase().includes('expired')) {
        throw new AuthError(ErrorCode.AUTH_TOKEN_EXPIRED, 'Sesi telah berakhir, silakan login ulang');
      }
      throw new AuthError(ErrorCode.AUTH_TOKEN_INVALID, msg);
    }
    return user;
  }
}
