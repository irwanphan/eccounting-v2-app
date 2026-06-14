import { Injectable } from '@nestjs/common';
import { type Firm, firms } from '@eccounting/db';
import { ErrorCode, NotFoundError } from '@eccounting/shared';
import { eq } from 'drizzle-orm';

import { DbService } from '../../infra/db/db.service';

@Injectable()
export class FirmsService {
  constructor(private readonly db: DbService) {}

  async getById(id: bigint): Promise<Firm> {
    const [row] = await this.db.db.select().from(firms).where(eq(firms.id, id)).limit(1);
    if (!row) throw new NotFoundError(ErrorCode.COMPANY_NOT_FOUND, `Firm ${id} tidak ditemukan`);
    return row;
  }

  toDto(firm: Firm): Record<string, unknown> {
    return {
      id: String(firm.id),
      name: firm.name,
      npwp: firm.npwp,
      address: firm.address,
      phone: firm.phone,
      email: firm.email,
      timezone: firm.timezone,
      createdAt: firm.createdAt.toISOString(),
      updatedAt: firm.updatedAt.toISOString(),
    };
  }
}
