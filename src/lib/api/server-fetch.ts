import { headers } from 'next/headers';
import { absoluteAppUrl } from '@/lib/email/app-url';

export async function serverFetch<T>(path: string): Promise<T> {
  const cookie = headers().get('cookie') ?? '';
  const url = absoluteAppUrl(path);
  const res = await fetch(url, {
    headers: { cookie },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`API ${path} failed with status ${res.status}`);
  }

  return res.json() as Promise<T>;
}
