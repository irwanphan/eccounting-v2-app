import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { accounts, journalLines } from '@eccounting/db';
import type {
  AccountCategory,
  AccountTreeResponse,
  CoaFormInput,
} from '@eccounting/shared';
import {
  V1_CATEGORY_TO_ACCOUNT_CATEGORY,
  type V1CoaCategoryId,
} from '@eccounting/shared';
import { and, asc, eq } from 'drizzle-orm';

import {
  buildAccountTree,
  collectDescendantIds,
  flattenAccountRows,
  type AccountRowForTree,
} from '../../common/account-tree.util';
import { DbService } from '../../infra/db/db.service';

@Injectable()
export class AccountsService {
  constructor(private readonly db: DbService) {}

  async getTree(companyId: bigint): Promise<AccountTreeResponse> {
    const rows = await this.fetchAccountRows(companyId);
    return {
      tree: buildAccountTree(rows),
      flat: flattenAccountRows(rows),
    };
  }

  async create(companyId: bigint, input: CoaFormInput): Promise<AccountTreeResponse> {
    await this.assertCodeUnique(companyId, input.code);

    const parentId = input.parentId != null ? BigInt(input.parentId) : null;
    if (parentId != null) {
      await this.assertAccountBelongsToCompany(companyId, parentId);
    }

    const { category, subCategory } = await this.resolveCategoryFields(
      companyId,
      input.categoryId,
      parentId,
      input.code,
    );

    await this.db.db.insert(accounts).values({
      companyId,
      parentId,
      code: input.code.trim(),
      name: input.name.trim(),
      category,
      subCategory,
      normalBalance: input.normalBalance,
      isPostable: false,
      isRetainedEarning: false,
    });

    return this.getTree(companyId);
  }

  async update(
    companyId: bigint,
    accountId: bigint,
    input: CoaFormInput,
  ): Promise<AccountTreeResponse> {
    const existing = await this.assertAccountBelongsToCompany(companyId, accountId);

    if (input.code.trim() !== existing.code) {
      await this.assertCodeUnique(companyId, input.code, accountId);
    }

    const parentId =
      input.parentId !== undefined
        ? input.parentId != null
          ? BigInt(input.parentId)
          : null
        : existing.parentId;

    if (parentId != null) {
      await this.assertAccountBelongsToCompany(companyId, parentId);
      if (parentId === accountId) {
        throw new BadRequestException('Akun tidak boleh menjadi induk dirinya sendiri.');
      }
      const rows = await this.fetchAccountRows(companyId);
      const descendants = collectDescendantIds(rows, accountId);
      if (descendants.has(parentId)) {
        throw new BadRequestException(
          'Pilih induk kode akun yang lain. Kode akun tidak valid.',
        );
      }
    }

    const { category, subCategory } = await this.resolveCategoryFields(
      companyId,
      input.categoryId,
      parentId,
      input.code,
      existing.category,
      existing.subCategory,
    );

    await this.db.db
      .update(accounts)
      .set({
        parentId,
        code: input.code.trim(),
        name: input.name.trim(),
        category,
        subCategory,
        normalBalance: input.normalBalance,
      })
      .where(and(eq(accounts.id, accountId), eq(accounts.companyId, companyId)));

    if (input.isRetainedEarning !== undefined) {
      await this.applyRetainedEarningFlag(companyId, accountId, input.isRetainedEarning);
    }

    return this.getTree(companyId);
  }

  async remove(companyId: bigint, accountId: bigint): Promise<AccountTreeResponse> {
    await this.assertAccountBelongsToCompany(companyId, accountId);

    const [child] = await this.db.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.companyId, companyId), eq(accounts.parentId, accountId)))
      .limit(1);

    if (child) {
      throw new ConflictException(
        'Penghapusan gagal! Hapus turunan dari COA terlebih dahulu!',
      );
    }

    const [used] = await this.db.db
      .select({ id: journalLines.id })
      .from(journalLines)
      .where(and(eq(journalLines.companyId, companyId), eq(journalLines.accountId, accountId)))
      .limit(1);

    if (used) {
      throw new ConflictException(
        'Penghapusan gagal! Kode akun sudah dipakai di jurnal.',
      );
    }

    await this.db.db
      .delete(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.companyId, companyId)));

    return this.getTree(companyId);
  }

  private async fetchAccountRows(companyId: bigint): Promise<AccountRowForTree[]> {
    return this.db.db
      .select({
        id: accounts.id,
        parentId: accounts.parentId,
        code: accounts.code,
        name: accounts.name,
        level: accounts.level,
        category: accounts.category,
        subCategory: accounts.subCategory,
        normalBalance: accounts.normalBalance,
        isPostable: accounts.isPostable,
        isRetainedEarning: accounts.isRetainedEarning,
      })
      .from(accounts)
      .where(eq(accounts.companyId, companyId))
      .orderBy(asc(accounts.code));
  }

  private async assertAccountBelongsToCompany(
    companyId: bigint,
    accountId: bigint,
  ): Promise<AccountRowForTree> {
    const [row] = await this.db.db
      .select({
        id: accounts.id,
        parentId: accounts.parentId,
        code: accounts.code,
        name: accounts.name,
        level: accounts.level,
        category: accounts.category,
        subCategory: accounts.subCategory,
        normalBalance: accounts.normalBalance,
        isPostable: accounts.isPostable,
        isRetainedEarning: accounts.isRetainedEarning,
      })
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.companyId, companyId)))
      .limit(1);

    if (!row) {
      throw new NotFoundException('Kode akun tidak ditemukan.');
    }
    return row;
  }

  private async assertCodeUnique(
    companyId: bigint,
    code: string,
    excludeId?: bigint,
  ): Promise<void> {
    const [existing] = await this.db.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.companyId, companyId), eq(accounts.code, code.trim())))
      .limit(1);

    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Kode akun sudah terpakai. Masukan kode akun lain.');
    }
  }

  private async resolveCategoryFields(
    companyId: bigint,
    categoryId: number | undefined,
    parentId: bigint | null,
    code: string,
    fallbackCategory?: AccountCategory,
    fallbackSubCategory?: string | null,
  ): Promise<{ category: AccountCategory; subCategory: string | null }> {
    if (categoryId != null && categoryId > 0) {
      const v1Id = categoryId as Exclude<V1CoaCategoryId, 0>;
      return {
        category: V1_CATEGORY_TO_ACCOUNT_CATEGORY[v1Id],
        subCategory: String(categoryId),
      };
    }

    if (categoryId === 0) {
      if (parentId != null) {
        const parent = await this.assertAccountBelongsToCompany(companyId, parentId);
        return { category: parent.category, subCategory: null };
      }
      return {
        category: inferCategoryFromCode(code),
        subCategory: null,
      };
    }

    if (fallbackCategory) {
      return { category: fallbackCategory, subCategory: fallbackSubCategory ?? null };
    }

    if (parentId != null) {
      const parent = await this.assertAccountBelongsToCompany(companyId, parentId);
      return { category: parent.category, subCategory: parent.subCategory };
    }

    return { category: inferCategoryFromCode(code), subCategory: null };
  }

  /** Setara v1 coaLrpb — hanya satu akun LRPB per company. */
  private async applyRetainedEarningFlag(
    companyId: bigint,
    accountId: bigint,
    enabled: boolean,
  ): Promise<void> {
    if (enabled) {
      await this.db.db
        .update(accounts)
        .set({ isRetainedEarning: false })
        .where(eq(accounts.companyId, companyId));

      await this.db.db
        .update(accounts)
        .set({ isRetainedEarning: true })
        .where(and(eq(accounts.id, accountId), eq(accounts.companyId, companyId)));
    } else {
      await this.db.db
        .update(accounts)
        .set({ isRetainedEarning: false })
        .where(and(eq(accounts.id, accountId), eq(accounts.companyId, companyId)));
    }
  }
}

function inferCategoryFromCode(code: string): AccountCategory {
  const head = code.trim().charAt(0);
  switch (head) {
    case '1':
      return 'ASSET';
    case '2':
      return 'LIABILITY';
    case '3':
      return 'EQUITY';
    case '4':
      return 'REVENUE';
    case '5':
      return 'COGS';
    case '6':
      return 'EXPENSE';
    case '7':
      return 'OTHER_INCOME';
    case '8':
      return 'OTHER_EXPENSE';
    case '9':
      return 'TAX_EXPENSE';
    default:
      return 'EXPENSE';
  }
}
