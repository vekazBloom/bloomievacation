import assert from 'node:assert/strict';
import test from 'node:test';

test('getAppUrl prefers NEXT_PUBLIC_APP_URL', async () => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://bloomievacation.vercel.app/';
  delete process.env.VERCEL_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

  const { getAppUrl } = await import('../src/lib/email/app-url');
  assert.equal(getAppUrl(), 'https://bloomievacation.vercel.app');
});

test('getAppUrl falls back to Vercel production URL', async () => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'bloomievacation.vercel.app';

  const { getAppUrl } = await import('../src/lib/email/app-url');
  assert.equal(getAppUrl(), 'https://bloomievacation.vercel.app');
});
