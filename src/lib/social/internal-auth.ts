import type { NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

export function isInternalSocialRequest(request: NextRequest) {
  const expected = process.env.SOCIAL_CRON_SECRET?.trim();
  const authorization = request.headers.get('authorization') ?? '';
  const received = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!expected || !received) return false;
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return (
    expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes)
  );
}
