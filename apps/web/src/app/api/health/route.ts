import { NextResponse } from 'next/server';

import { ApiError, apiFetch } from '@/lib/api-client';

export async function GET(): Promise<NextResponse> {
  try {
    const data = await apiFetch<{ status: string; checks: Record<string, boolean> }>(
      '/health/ready',
    );
    return NextResponse.json(data, { status: data.status === 'ok' ? 200 : 503 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { status: 'down', error: { code: err.code, message: err.message } },
        { status: 503 },
      );
    }
    return NextResponse.json({ status: 'down', error: 'unknown' }, { status: 503 });
  }
}
