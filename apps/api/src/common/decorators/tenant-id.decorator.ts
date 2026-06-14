import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

/**
 * Ambil company ID dari header `X-Company-Id` atau param `:companyId`.
 * Wajib digunakan dengan TenantContextInterceptor / CompanyMemberGuard
 * untuk memastikan user adalah member dari tenant tersebut.
 */
export const TenantId = createParamDecorator((_data, ctx: ExecutionContext): bigint => {
  const request = ctx.switchToHttp().getRequest<FastifyRequest & { tenantId?: bigint }>();
  if (request.tenantId !== undefined) return request.tenantId;

  const fromParam = (request.params as Record<string, string | undefined>)?.companyId;
  const fromHeader = request.headers['x-company-id'];
  const raw = fromParam ?? (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader);

  if (!raw) {
    throw new Error('TenantId not found in request (X-Company-Id header or :companyId param)');
  }
  return BigInt(raw);
});
