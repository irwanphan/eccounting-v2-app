import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { AuthUserContext } from '../../common/decorators/current-user.decorator';

export interface JwtAccessPayload {
  sub: string;       // user id as string (BigInt safe)
  fid: string;       // firm id as string
  email: string;
  typ: 'access';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      issuer: config.get<string>('JWT_ISSUER') ?? 'eccounting-api',
      audience: config.get<string>('JWT_AUDIENCE') ?? 'eccounting-web',
    });
  }

  validate(payload: JwtAccessPayload): AuthUserContext {
    if (payload.typ !== 'access') {
      throw new Error('Token bukan access token');
    }
    return {
      userId: BigInt(payload.sub),
      firmId: BigInt(payload.fid),
      email: payload.email,
    };
  }
}
