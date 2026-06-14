import { createHash, randomBytes } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { refreshTokens } from '@eccounting/db';
import { AuthError, ErrorCode } from '@eccounting/shared';
import { and, eq, isNull, sql } from 'drizzle-orm';

import { DbService } from '../../infra/db/db.service';

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 hari

export interface IssuedRefreshToken {
  /** Token plain — HANYA dikembalikan ke caller saat issue/rotate. Tidak di-store. */
  token: string;
  /** ID baris di DB. */
  id: bigint;
  expiresAt: Date;
}

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);
  private readonly ttlSeconds: number;

  constructor(
    private readonly db: DbService,
    config: ConfigService,
  ) {
    this.ttlSeconds = Number(config.get<string>('REFRESH_TOKEN_TTL_SECONDS') ?? DEFAULT_TTL_SECONDS);
  }

  async issue(params: {
    userId: bigint;
    userAgent?: string;
    ipAddress?: string;
    replacesId?: bigint;
  }): Promise<IssuedRefreshToken> {
    const token = randomBytes(48).toString('base64url');
    const hash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);

    const [row] = await this.db.db
      .insert(refreshTokens)
      .values({
        userId: params.userId,
        tokenHash: hash,
        expiresAt,
        userAgent: params.userAgent ?? null,
        ipAddress: params.ipAddress ?? null,
      })
      .returning({ id: refreshTokens.id });

    if (!row) throw new Error('Failed to issue refresh token');

    if (params.replacesId) {
      await this.db.db
        .update(refreshTokens)
        .set({
          revokedAt: new Date(),
          revokedReason: 'rotated',
          replacedById: row.id,
        })
        .where(eq(refreshTokens.id, params.replacesId));
    }

    return { token, id: row.id, expiresAt };
  }

  /**
   * Verify & rotate refresh token. Mengikuti pola "refresh token rotation".
   * Kalau token yang dipakai sudah pernah di-revoke → curi-an, revoke seluruh chain user.
   */
  async rotate(params: {
    rawToken: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<{ userId: bigint; issued: IssuedRefreshToken }> {
    const hash = this.hashToken(params.rawToken);

    const [existing] = await this.db.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hash))
      .limit(1);

    if (!existing) {
      throw new AuthError(ErrorCode.AUTH_REFRESH_TOKEN_INVALID, 'Refresh token tidak dikenali');
    }
    if (existing.revokedAt) {
      // Token sudah di-revoke tapi dipakai lagi → indikasi token theft.
      // Revoke seluruh active token user untuk safety.
      await this.revokeAllForUser(existing.userId, 'token_reuse_detected');
      this.logger.warn(
        `Refresh token reuse detected for user=${existing.userId}, revoked all sessions`,
      );
      throw new AuthError(
        ErrorCode.AUTH_REFRESH_TOKEN_REUSED,
        'Refresh token sudah dipakai sebelumnya — sesi telah di-revoke untuk keamanan',
      );
    }
    if (existing.expiresAt.getTime() < Date.now()) {
      throw new AuthError(ErrorCode.AUTH_TOKEN_EXPIRED, 'Refresh token telah expired');
    }

    const issued = await this.issue({
      userId: existing.userId,
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
      replacesId: existing.id,
    });

    return { userId: existing.userId, issued };
  }

  async revoke(rawToken: string, reason: string = 'user_logout'): Promise<void> {
    const hash = this.hashToken(rawToken);
    await this.db.db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(refreshTokens.tokenHash, hash), isNull(refreshTokens.revokedAt)));
  }

  async revokeAllForUser(userId: bigint, reason: string = 'user_logout_all'): Promise<void> {
    await this.db.db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  }

  /** Cleanup expired tokens — bisa dipanggil cron worker. */
  async pruneExpired(): Promise<number> {
    const result = await this.db.db.execute<{ count: number }>(sql`
      DELETE FROM eccounting.refresh_tokens
      WHERE expires_at < now() - interval '7 days'
      RETURNING 1
    `);
    return result.rows.length;
  }

  private hashToken(token: string): Buffer {
    return createHash('sha256').update(token).digest();
  }
}
