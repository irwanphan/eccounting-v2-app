import { createHash, randomBytes } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { passwordResetTokens, users } from '@eccounting/db';
import { AuthError, ErrorCode } from '@eccounting/shared';
import { and, eq, isNull, sql } from 'drizzle-orm';

import { DbService } from '../../infra/db/db.service';

const DEFAULT_TTL_SECONDS = 60 * 60; // 1 jam

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly ttlSeconds: number;

  constructor(
    private readonly db: DbService,
    config: ConfigService,
  ) {
    this.ttlSeconds = Number(
      config.get<string>('PASSWORD_RESET_TTL_SECONDS') ?? DEFAULT_TTL_SECONDS,
    );
  }

  /**
   * Issue token reset password. Token plain di-return supaya bisa dikirim via email.
   * Token disimpan sebagai sha256 hash.
   *
   * Invalidate token sebelumnya untuk user yang sama (single active token).
   */
  async issue(userId: bigint, requestedIp?: string): Promise<{ token: string; expiresAt: Date }> {
    // Invalidate token lama
    await this.db.db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));

    const token = randomBytes(48).toString('base64url');
    const hash = createHash('sha256').update(token).digest();
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);

    await this.db.db.insert(passwordResetTokens).values({
      userId,
      tokenHash: hash,
      expiresAt,
      requestedIp: requestedIp ?? null,
    });

    return { token, expiresAt };
  }

  /**
   * Verify token & mark sebagai used. Return userId yang valid.
   * Throw error kalau token invalid/expired/used.
   */
  async consume(rawToken: string): Promise<bigint> {
    const hash = createHash('sha256').update(rawToken).digest();

    const [row] = await this.db.db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, hash))
      .limit(1);

    if (!row) {
      throw new AuthError(ErrorCode.AUTH_PASSWORD_RESET_INVALID, 'Token reset password tidak valid');
    }
    if (row.usedAt) {
      throw new AuthError(
        ErrorCode.AUTH_PASSWORD_RESET_INVALID,
        'Token reset password sudah pernah dipakai',
      );
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new AuthError(ErrorCode.AUTH_PASSWORD_RESET_EXPIRED, 'Token reset password telah expired');
    }

    await this.db.db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, row.id));

    return row.userId;
  }

  async pruneExpired(): Promise<number> {
    const result = await this.db.db.execute(sql`
      DELETE FROM eccounting.password_reset_tokens
      WHERE expires_at < now() - interval '7 days'
    `);
    return result.rowCount ?? 0;
  }

  /**
   * Untuk dev/testing: log token ke console (production harus email).
   * Real email sender belum diimplementasi; ini placeholder yang aman.
   */
  logResetLink(email: string, token: string): void {
    const url = `${process.env.WEB_URL ?? 'http://localhost:3000'}/reset-password?token=${token}`;
    this.logger.warn(`[DEV] Password reset link untuk ${email}: ${url}`);
  }

  /** Lookup user by email tanpa membocorkan keberadaannya. */
  async findUserByEmail(email: string): Promise<bigint | null> {
    const [row] = await this.db.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return row?.id ?? null;
  }
}
