import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  AuthError,
  type ChangePasswordRequest,
  type ConfirmPasswordResetInput,
  ErrorCode,
  type LoginRequest,
  type LoginResponse,
} from '@eccounting/shared';

import { PasswordHasherService } from '../../common/services/password-hasher.service';
import { UsersService } from '../users/users.service';
import { PasswordResetService } from './password-reset.service';
import { RefreshTokenService } from './refresh-token.service';
import type { JwtAccessPayload } from './jwt.strategy';

interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTtlSeconds: number;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly hasher: PasswordHasherService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly passwordReset: PasswordResetService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.accessTtlSeconds = Number(config.get<string>('JWT_ACCESS_TTL_SECONDS') ?? 900); // 15 min
    this.issuer = config.get<string>('JWT_ISSUER') ?? 'eccounting-api';
    this.audience = config.get<string>('JWT_AUDIENCE') ?? 'eccounting-web';
  }

  async login(input: LoginRequest, meta: RequestMeta): Promise<LoginResponse> {
    const user = await this.usersService.findByEmail(input.email);
    if (!user) {
      // Anti enumeration: jangan beda-bedakan "user not found" vs "wrong password"
      throw new AuthError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Email atau password salah');
    }
    if (!user.isActive) {
      throw new AuthError(ErrorCode.AUTH_USER_INACTIVE, 'Akun dinonaktifkan');
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new AuthError(
        ErrorCode.AUTH_USER_LOCKED,
        `Akun terkunci sampai ${user.lockedUntil.toISOString()}`,
      );
    }

    const valid = await this.hasher.verify(input.password, user.passwordHash);
    if (!valid) {
      const state = await this.usersService.recordFailedLogin(user.id);
      this.logger.warn(`Failed login for ${user.email} (count=${state.failedCount})`);
      throw new AuthError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Email atau password salah');
    }

    await this.usersService.recordSuccessfulLogin(user.id);

    // Lazy migration: rehash bcrypt → argon2id setelah berhasil login
    if (this.hasher.needsRehash(user.passwordHash)) {
      try {
        const newHash = await this.hasher.hash(input.password);
        await this.usersService.updatePassword(user.id, newHash);
        this.logger.log(`Rehashed password for user=${user.id} (bcrypt → argon2id)`);
      } catch (err) {
        this.logger.error(`Failed to rehash password for user=${user.id}`, err);
        // Bukan critical, lanjutkan login
      }
    }

    return this.buildLoginResponse(user, meta);
  }

  async refresh(rawToken: string, meta: RequestMeta): Promise<LoginResponse> {
    const { userId, issued } = await this.refreshTokens.rotate({
      rawToken,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });
    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      throw new AuthError(ErrorCode.AUTH_USER_INACTIVE, 'User tidak aktif');
    }

    const accessToken = this.signAccessToken(user.id, user.firmId, user.email);

    return {
      accessToken,
      refreshToken: issued.token,
      tokenType: 'Bearer',
      expiresIn: this.accessTtlSeconds,
      user: {
        id: String(user.id),
        firmId: String(user.firmId),
        email: user.email,
        name: user.name,
      },
    };
  }

  async logout(rawToken: string): Promise<void> {
    await this.refreshTokens.revoke(rawToken, 'user_logout');
  }

  async logoutAll(userId: bigint): Promise<void> {
    await this.refreshTokens.revokeAllForUser(userId, 'user_logout_all');
  }

  async changePassword(userId: bigint, input: ChangePasswordRequest): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new AuthError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'User tidak ditemukan');

    const valid = await this.hasher.verify(input.currentPassword, user.passwordHash);
    if (!valid) {
      throw new AuthError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Password saat ini salah');
    }

    const newHash = await this.hasher.hash(input.newPassword);
    await this.usersService.updatePassword(user.id, newHash);

    // Revoke semua refresh token — paksa re-login di semua device
    await this.refreshTokens.revokeAllForUser(user.id, 'password_changed');
  }

  /**
   * Request reset link. Selalu return 'sukses' supaya tidak leak keberadaan email.
   * Hanya kirim email (atau log link di dev) kalau user benar-benar ada.
   */
  async requestPasswordReset(email: string, ipAddress?: string): Promise<void> {
    const userId = await this.passwordReset.findUserByEmail(email);
    if (!userId) {
      this.logger.log(`Password reset requested untuk email tidak terdaftar: ${email}`);
      return;
    }
    const { token } = await this.passwordReset.issue(userId, ipAddress);
    this.passwordReset.logResetLink(email, token);
    // TODO: kirim email beneran lewat MailService
  }

  async confirmPasswordReset(input: ConfirmPasswordResetInput): Promise<void> {
    const userId = await this.passwordReset.consume(input.token);
    const newHash = await this.hasher.hash(input.newPassword);
    await this.usersService.updatePassword(userId, newHash);
    await this.refreshTokens.revokeAllForUser(userId, 'password_reset');
  }

  // ---------------------------------------------------------------------------

  private async buildLoginResponse(
    user: { id: bigint; firmId: bigint; email: string; name: string },
    meta: RequestMeta,
  ): Promise<LoginResponse> {
    const accessToken = this.signAccessToken(user.id, user.firmId, user.email);
    const refresh = await this.refreshTokens.issue({
      userId: user.id,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });
    return {
      accessToken,
      refreshToken: refresh.token,
      tokenType: 'Bearer',
      expiresIn: this.accessTtlSeconds,
      user: {
        id: String(user.id),
        firmId: String(user.firmId),
        email: user.email,
        name: user.name,
      },
    };
  }

  private signAccessToken(userId: bigint, firmId: bigint, email: string): string {
    const payload: JwtAccessPayload = {
      sub: String(userId),
      fid: String(firmId),
      email,
      typ: 'access',
    };
    return this.jwt.sign(payload, {
      expiresIn: this.accessTtlSeconds,
      issuer: this.issuer,
      audience: this.audience,
    });
  }
}
