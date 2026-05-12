import { NextRequest } from 'next/server';

export function isAuthorizedCronRequest(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }

  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}
