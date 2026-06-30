/**
 * Thin fetch wrapper untuk komunikasi ke NestJS API.
 *
 * Setelah `pnpm codegen` dijalankan (membutuhkan API running), file
 * `src/generated/api-types.ts` akan berisi tipe dari OpenAPI spec.
 * Wrapper ini akan ditingkatkan untuk type-safe consumption nantinya
 * (mis. via openapi-fetch atau orval-generated hooks).
 */

import type { ApiErrorBody, ErrorCodeValue } from '@eccounting/shared';

import { getAccessToken } from './auth-store';
import { getSelectedCompany } from './company-store';
import {
  redirectToSessionExpired,
  shouldHandleAsSessionExpired,
  waitForSessionRedirect,
} from './session-expired';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  companyId?: string | bigint | number;
  authToken?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCodeValue | 'NETWORK_ERROR' | 'UNKNOWN',
    message: string,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  { body, companyId, authToken, headers, ...init }: RequestOptions = {},
): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const token = authToken ?? getAccessToken() ?? undefined;
  const tenantId = companyId ?? getSelectedCompany()?.id;

  const finalHeaders = new Headers(headers);
  finalHeaders.set('Accept', 'application/json');
  if (body !== undefined && !(body instanceof FormData)) {
    finalHeaders.set('Content-Type', 'application/json');
  }
  if (tenantId !== undefined) {
    finalHeaders.set('X-Company-Id', String(tenantId));
  }
  if (token) {
    finalHeaders.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: finalHeaders,
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch (cause) {
    throw new ApiError(0, 'NETWORK_ERROR', 'Tidak dapat terhubung ke API', { cause });
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const json = text ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    const errBody = json as ApiErrorBody | undefined;
    const code = errBody?.error?.code ?? 'UNKNOWN';
    if (shouldHandleAsSessionExpired(response.status, code, Boolean(token))) {
      redirectToSessionExpired();
      return waitForSessionRedirect();
    }
    throw new ApiError(
      response.status,
      code,
      errBody?.error?.message ?? response.statusText,
      errBody?.error?.details,
      errBody?.error?.requestId,
    );
  }

  return json as T;
}

/** Unduh file binary (Excel, CSV, dll.) dari API — setara v1 location.href download. */
export async function apiDownload(
  path: string,
  filename: string,
  { body, companyId, authToken, headers, ...init }: RequestOptions = {},
): Promise<void> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const token = authToken ?? getAccessToken() ?? undefined;
  const tenantId = companyId ?? getSelectedCompany()?.id;

  const finalHeaders = new Headers(headers);
  if (body !== undefined && !(body instanceof FormData)) {
    finalHeaders.set('Content-Type', 'application/json');
  }
  if (tenantId !== undefined) {
    finalHeaders.set('X-Company-Id', String(tenantId));
  }
  if (token) {
    finalHeaders.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: finalHeaders,
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch (cause) {
    throw new ApiError(0, 'NETWORK_ERROR', 'Tidak dapat terhubung ke API', { cause });
  }

  if (!response.ok) {
    const text = await response.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }
    const errBody = json as ApiErrorBody | undefined;
    const code = errBody?.error?.code ?? 'UNKNOWN';
    if (shouldHandleAsSessionExpired(response.status, code, Boolean(token))) {
      redirectToSessionExpired();
      return waitForSessionRedirect();
    }
    throw new ApiError(
      response.status,
      code,
      errBody?.error?.message ?? response.statusText,
      errBody?.error?.details,
      errBody?.error?.requestId,
    );
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
