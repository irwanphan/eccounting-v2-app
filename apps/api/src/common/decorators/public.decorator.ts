import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark endpoint sebagai public (bypass JwtAuthGuard global).
 * Pakai untuk /auth/login, /auth/refresh, /auth/forgot-password, /health, dll.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
