import { Injectable } from '@nestjs/common';
import { type User, users } from '@eccounting/db';
import { and, eq, sql } from 'drizzle-orm';

import { DbService } from '../../infra/db/db.service';

const MAX_FAILED_BEFORE_LOCKOUT = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class UsersService {
  constructor(private readonly db: DbService) {}

  findById(id: bigint): Promise<User | undefined> {
    return this.db.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
      .then((rows) => rows[0]);
  }

  findByEmail(email: string, firmId?: bigint): Promise<User | undefined> {
    const where = firmId
      ? and(eq(users.email, email), eq(users.firmId, firmId))
      : eq(users.email, email);

    return this.db.db
      .select()
      .from(users)
      .where(where)
      .limit(1)
      .then((rows) => rows[0]);
  }

  async recordSuccessfulLogin(userId: bigint): Promise<void> {
    await this.db.db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
      })
      .where(eq(users.id, userId));
  }

  /**
   * Tambah counter & kunci akun kalau melewati threshold.
   * Return: state lockout setelah operasi.
   */
  async recordFailedLogin(userId: bigint): Promise<{ failedCount: number; lockedUntil: Date | null }> {
    const lockedUntilExpr = sql`
      CASE
        WHEN ${users.failedLoginCount} + 1 >= ${MAX_FAILED_BEFORE_LOCKOUT}
        THEN now() + interval '${sql.raw(String(LOCKOUT_MINUTES))} minutes'
        ELSE NULL
      END
    `;

    const [row] = await this.db.db
      .update(users)
      .set({
        failedLoginCount: sql`${users.failedLoginCount} + 1`,
        lockedUntil: lockedUntilExpr as never,
      })
      .where(eq(users.id, userId))
      .returning({
        failedCount: users.failedLoginCount,
        lockedUntil: users.lockedUntil,
      });

    return { failedCount: row?.failedCount ?? 0, lockedUntil: row?.lockedUntil ?? null };
  }

  async updatePassword(userId: bigint, newHash: string): Promise<void> {
    await this.db.db
      .update(users)
      .set({
        passwordHash: newHash,
        passwordHashAlgo: 'argon2id',
        passwordChangedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }
}
