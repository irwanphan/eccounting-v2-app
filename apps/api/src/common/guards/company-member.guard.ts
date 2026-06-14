import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { AuthError, ErrorCode, NotFoundError } from '@eccounting/shared';

import { DRIZZLE_DB } from '../../infra/db/db.service';
import type { Database } from '@eccounting/db';
import type { AuthUserContext } from '../decorators/current-user.decorator';

/**
 * Guard yang memverifikasi:
 *  1. Header X-Company-Id (atau :companyId di route param) terisi
 *  2. Company exists & belum archived
 *  3. CurrentUser punya membership aktif di company tsb
 *
 * Set `req.companyContext` untuk dipakai TenantId decorator & service downstream.
 */
@Injectable()
export class CompanyMemberGuard implements CanActivate {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      user?: AuthUserContext;
      headers: Record<string, string | undefined>;
      params: Record<string, string | undefined>;
      companyContext?: { companyId: bigint; role: 'owner' | 'accountant' | 'viewer' };
    }>();

    const rawCompanyId = req.headers['x-company-id'] ?? req.params.companyId;
    if (!rawCompanyId) {
      throw new AuthError(
        ErrorCode.AUTH_NOT_COMPANY_MEMBER,
        'X-Company-Id header atau :companyId param wajib diisi',
      );
    }
    if (!req.user) {
      throw new AuthError(ErrorCode.AUTH_TOKEN_INVALID, 'User context tidak tersedia');
    }

    let companyId: bigint;
    try {
      companyId = BigInt(rawCompanyId);
    } catch {
      throw new AuthError(ErrorCode.AUTH_NOT_COMPANY_MEMBER, 'X-Company-Id tidak valid');
    }

    const result = await this.db.execute<{
      company_id: bigint;
      archived: boolean;
      role: 'owner' | 'accountant' | 'viewer' | null;
    }>(sql`
      SELECT
        c.id            AS company_id,
        c.archived_at IS NOT NULL AS archived,
        cm.role         AS role
      FROM eccounting.companies c
      LEFT JOIN eccounting.company_members cm
        ON cm.company_id = c.id AND cm.user_id = ${req.user.userId}
      WHERE c.id = ${companyId}
        AND c.firm_id = ${req.user.firmId}
    `);

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError(ErrorCode.COMPANY_NOT_FOUND, `Company ${rawCompanyId} tidak ditemukan`);
    }
    if (row.archived) {
      throw new AuthError(ErrorCode.COMPANY_ARCHIVED, 'Pembukuan klien ini sudah di-archive');
    }
    if (!row.role) {
      throw new AuthError(
        ErrorCode.AUTH_NOT_COMPANY_MEMBER,
        'Anda bukan member dari company ini',
      );
    }

    req.companyContext = { companyId, role: row.role };
    return true;
  }
}
