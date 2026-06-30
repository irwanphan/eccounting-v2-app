import { Injectable } from '@nestjs/common';
import { type User, companyMembers, companies, users } from '@eccounting/db';
import {
  type CompanyRole,
  type CreateUserInput,
  type UpdateUserInput,
  type UserListItem,
  type UserMembershipItem,
  ConflictError,
  ErrorCode,
  ForbiddenError,
  NotFoundError,
} from '@eccounting/shared';
import { and, asc, count, eq, inArray, isNull, sql } from 'drizzle-orm';

import { PasswordHasherService } from '../../common/services/password-hasher.service';
import { DbService } from '../../infra/db/db.service';

const MAX_FAILED_BEFORE_LOCKOUT = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class UsersService {
  constructor(
    private readonly db: DbService,
    private readonly hasher: PasswordHasherService,
  ) {}

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

  async listForFirm(firmId: bigint): Promise<UserListItem[]> {
    const rows = await this.db.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        membershipCount: sql<number>`COALESCE(${count(companyMembers.userId)}, 0)::int`.as(
          'membership_count',
        ),
      })
      .from(users)
      .leftJoin(companyMembers, eq(companyMembers.userId, users.id))
      .where(eq(users.firmId, firmId))
      .groupBy(users.id)
      .orderBy(asc(users.name));

    return rows.map((row) => this.toListItem(row));
  }

  async listMemberships(userId: bigint, firmId: bigint): Promise<UserMembershipItem[]> {
    await this.getByIdForFirm(userId, firmId);

    const rows = await this.db.db
      .select({
        companyId: companyMembers.companyId,
        companyName: companies.name,
        role: companyMembers.role,
      })
      .from(companyMembers)
      .innerJoin(companies, eq(companies.id, companyMembers.companyId))
      .where(and(eq(companyMembers.userId, userId), eq(companies.firmId, firmId)))
      .orderBy(asc(companies.name));

    return rows.map((row) => ({
      companyId: String(row.companyId),
      companyName: row.companyName,
      role: row.role as UserMembershipItem['role'],
    }));
  }

  async addAllMemberships(
    userId: bigint,
    firmId: bigint,
    role: CompanyRole,
  ): Promise<{ count: number }> {
    await this.getByIdForFirm(userId, firmId);

    const firmCompanies = await this.db.db
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.firmId, firmId), isNull(companies.archivedAt)));

    if (firmCompanies.length === 0) return { count: 0 };

    const existing = await this.db.db
      .select({ companyId: companyMembers.companyId })
      .from(companyMembers)
      .innerJoin(companies, eq(companies.id, companyMembers.companyId))
      .where(and(eq(companyMembers.userId, userId), eq(companies.firmId, firmId)));

    const existingIds = new Set(existing.map((row) => row.companyId));
    const toAdd = firmCompanies.filter((company) => !existingIds.has(company.id));

    if (toAdd.length === 0) return { count: 0 };

    await this.db.db.insert(companyMembers).values(
      toAdd.map((company) => ({
        companyId: company.id,
        userId,
        role,
      })),
    );

    return { count: toAdd.length };
  }

  async removeAllMemberships(userId: bigint, firmId: bigint): Promise<{ count: number }> {
    await this.getByIdForFirm(userId, firmId);

    const firmCompanies = await this.db.db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.firmId, firmId));

    const companyIds = firmCompanies.map((company) => company.id);
    if (companyIds.length === 0) return { count: 0 };

    const deleted = await this.db.db
      .delete(companyMembers)
      .where(and(eq(companyMembers.userId, userId), inArray(companyMembers.companyId, companyIds)))
      .returning({ companyId: companyMembers.companyId });

    return { count: deleted.length };
  }

  async create(input: CreateUserInput, firmId: bigint): Promise<UserListItem> {
    const existing = await this.findByEmail(input.email, firmId);
    if (existing) {
      throw new ConflictError(
        ErrorCode.USER_EMAIL_DUPLICATE,
        `Email ${input.email} sudah terdaftar di firm ini`,
      );
    }

    const passwordHash = await this.hasher.hash(input.password);

    try {
      const [created] = await this.db.db
        .insert(users)
        .values({
          firmId,
          email: input.email,
          name: input.name,
          passwordHash,
          passwordHashAlgo: 'argon2id',
        })
        .returning();

      if (!created) throw new Error('Gagal membuat pengguna');

      return this.toListItem({ ...created, membershipCount: 0 });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictError(
          ErrorCode.USER_EMAIL_DUPLICATE,
          `Email ${input.email} sudah terdaftar di firm ini`,
        );
      }
      throw err;
    }
  }

  async update(
    userId: bigint,
    firmId: bigint,
    actorUserId: bigint,
    input: UpdateUserInput,
  ): Promise<UserListItem> {
    const existing = await this.getByIdForFirm(userId, firmId);

    if (input.isActive === false && userId === actorUserId) {
      throw new ForbiddenError(
        ErrorCode.USER_CANNOT_DEACTIVATE_SELF,
        'Tidak bisa menonaktifkan akun sendiri',
      );
    }

    const patch: Partial<typeof users.$inferInsert> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    if (input.password !== undefined) {
      patch.passwordHash = await this.hasher.hash(input.password);
      patch.passwordHashAlgo = 'argon2id';
      patch.passwordChangedAt = new Date();
      patch.failedLoginCount = 0;
      patch.lockedUntil = null;
    }

    const [updated] = await this.db.db
      .update(users)
      .set(patch)
      .where(and(eq(users.id, existing.id), eq(users.firmId, firmId)))
      .returning();

    if (!updated) throw new NotFoundError(ErrorCode.USER_NOT_FOUND, `User ${userId} tidak ditemukan`);

    const [membershipRow] = await this.db.db
      .select({ membershipCount: count(companyMembers.userId) })
      .from(companyMembers)
      .where(eq(companyMembers.userId, updated.id));

    return this.toListItem({
      ...updated,
      membershipCount: Number(membershipRow?.membershipCount ?? 0),
    });
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

  private async getByIdForFirm(userId: bigint, firmId: bigint): Promise<User> {
    const [row] = await this.db.db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.firmId, firmId)))
      .limit(1);

    if (!row) {
      throw new NotFoundError(ErrorCode.USER_NOT_FOUND, `User ${userId} tidak ditemukan`);
    }

    return row;
  }

  private toListItem(row: {
    id: bigint;
    email: string;
    name: string;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    membershipCount: number;
  }): UserListItem {
    return {
      id: String(row.id),
      email: row.email,
      name: row.name,
      isActive: row.isActive,
      lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      membershipCount: row.membershipCount,
    };
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}
