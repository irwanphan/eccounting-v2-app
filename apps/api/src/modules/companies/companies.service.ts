import { Injectable, Logger } from '@nestjs/common';
import {
  type Company,
  type CompanyMember,
  type Database,
  type Transaction,
  companies,
  companyMembers,
} from '@eccounting/db';
import {
  type CompanyRole,
  type CreateCompanyInput,
  ErrorCode,
  NotFoundError,
} from '@eccounting/shared';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import { DbService } from '../../infra/db/db.service';

interface CreatorContext {
  userId: bigint;
  firmId: bigint;
}

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(private readonly db: DbService) {}

  async listForFirm(firmId: bigint, includeArchived = false): Promise<Company[]> {
    const where = includeArchived
      ? eq(companies.firmId, firmId)
      : and(eq(companies.firmId, firmId), isNull(companies.archivedAt));

    return this.db.db.select().from(companies).where(where).orderBy(asc(companies.name));
  }

  async listForUser(userId: bigint, firmId: bigint): Promise<Array<Company & { role: CompanyRole }>> {
    const rows = await this.db.db
      .select({
        company: companies,
        role: companyMembers.role,
      })
      .from(companyMembers)
      .innerJoin(companies, eq(companies.id, companyMembers.companyId))
      .where(and(eq(companyMembers.userId, userId), eq(companies.firmId, firmId)))
      .orderBy(asc(companies.name));

    return rows.map((r) => ({ ...r.company, role: r.role as CompanyRole }));
  }

  async getById(id: bigint, firmId: bigint): Promise<Company> {
    const [row] = await this.db.db
      .select()
      .from(companies)
      .where(and(eq(companies.id, id), eq(companies.firmId, firmId)))
      .limit(1);
    if (!row) throw new NotFoundError(ErrorCode.COMPANY_NOT_FOUND, `Company ${id} tidak ditemukan`);
    return row;
  }

  /**
   * Create company + auto-seed COA + accounting periods + add creator sebagai owner.
   * Semua atomic dalam 1 transaction.
   */
  async create(input: CreateCompanyInput, ctx: CreatorContext): Promise<Company> {
    return this.db.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(companies)
        .values({
          firmId: ctx.firmId,
          name: input.name,
          npwp: input.npwp ?? null,
          address: input.address ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          baseCurrency: input.baseCurrency,
          fiscalYearStartMonth: input.fiscalYearStartMonth,
          postingNumberPrefix: input.postingNumberPrefix,
          createdBy: ctx.userId,
        })
        .returning();

      if (!created) throw new Error('Failed to insert company');

      // Tambah creator sebagai owner
      await tx.insert(companyMembers).values({
        companyId: created.id,
        userId: ctx.userId,
        role: 'owner',
      });

      if (input.seedDefaultCoa) {
        await this.seedDefaultCoa(tx, created.id);
        await this.bootstrapAccountingPeriods(tx, created.id);
      }

      this.logger.log(`Company ${created.id} (${created.name}) created by user ${ctx.userId}`);
      return created;
    });
  }

  async archive(id: bigint, firmId: bigint): Promise<void> {
    await this.db.db
      .update(companies)
      .set({ archivedAt: new Date() })
      .where(and(eq(companies.id, id), eq(companies.firmId, firmId)));
  }

  async addMember(
    companyId: bigint,
    userId: bigint,
    role: CompanyRole,
  ): Promise<CompanyMember> {
    const [row] = await this.db.db
      .insert(companyMembers)
      .values({ companyId, userId, role })
      .onConflictDoUpdate({
        target: [companyMembers.companyId, companyMembers.userId],
        set: { role },
      })
      .returning();
    if (!row) throw new Error('Failed to add member');
    return row;
  }

  async removeMember(companyId: bigint, userId: bigint): Promise<void> {
    await this.db.db
      .delete(companyMembers)
      .where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)));
  }

  toDto(company: Company & { role?: CompanyRole }): Record<string, unknown> {
    return {
      id: String(company.id),
      firmId: String(company.firmId),
      name: company.name,
      npwp: company.npwp,
      address: company.address,
      phone: company.phone,
      email: company.email,
      baseCurrency: company.baseCurrency,
      fiscalYearStartMonth: company.fiscalYearStartMonth,
      postingNumberPrefix: company.postingNumberPrefix,
      legacyV1ClientId: company.legacyV1ClientId ? String(company.legacyV1ClientId) : null,
      archivedAt: company.archivedAt ? company.archivedAt.toISOString() : null,
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString(),
      ...(company.role ? { role: company.role } : {}),
    };
  }

  // ---------------------------------------------------------------------------

  private async seedDefaultCoa(tx: Transaction | Database, companyId: bigint): Promise<void> {
    await tx.execute(sql`SELECT eccounting.seed_default_coa(${companyId}::bigint)`);
  }

  private async bootstrapAccountingPeriods(
    tx: Transaction | Database,
    companyId: bigint,
  ): Promise<void> {
    const year = new Date().getFullYear();
    await tx.execute(
      sql`SELECT eccounting.bootstrap_accounting_periods(${companyId}::bigint, ${year}::smallint)`,
    );
  }
}
