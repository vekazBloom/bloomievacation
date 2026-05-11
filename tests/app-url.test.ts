import assert from 'node:assert/strict';
import test from 'node:test';

function resetAppUrlEnv() {
  delete process.env.APP_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.VERCEL_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.VERCEL_ENV;
}

test('getAppUrl prefers NEXT_PUBLIC_APP_URL', async () => {
  resetAppUrlEnv();
  process.env.NEXT_PUBLIC_APP_URL = 'https://bloomievacation.vercel.app/';

  const { getAppUrl } = await import('../src/lib/email/app-url');
  assert.equal(getAppUrl(), 'https://bloomievacation.vercel.app');
});

test('getAppUrl prefers APP_URL over localhost NEXT_PUBLIC_APP_URL', async () => {
  resetAppUrlEnv();
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  process.env.APP_URL = 'https://bloomievacation.vercel.app';

  const { getAppUrl } = await import('../src/lib/email/app-url');
  assert.equal(getAppUrl(), 'https://bloomievacation.vercel.app');
});

test('getAppUrl falls back to Vercel production URL', async () => {
  resetAppUrlEnv();
  process.env.VERCEL_ENV = 'production';
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'bloomievacation.vercel.app';

  const { getAppUrl } = await import('../src/lib/email/app-url');
  assert.equal(getAppUrl(), 'https://bloomievacation.vercel.app');
});

test('getAppUrl ignores localhost NEXT_PUBLIC_APP_URL when Vercel URL is available', async () => {
  resetAppUrlEnv();
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  process.env.VERCEL_ENV = 'production';
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'bloomievacation.vercel.app';

  const { getAppUrl } = await import('../src/lib/email/app-url');
  assert.equal(getAppUrl(), 'https://bloomievacation.vercel.app');
});

test('absoluteAppUrl builds request links from the resolved app URL', async () => {
  resetAppUrlEnv();
  process.env.NEXT_PUBLIC_APP_URL = 'https://bloomievacation.vercel.app';

  const { absoluteAppUrl } = await import('../src/lib/email/app-url');
  assert.equal(
    absoluteAppUrl('/projects/project-id/requests/request-id'),
    'https://bloomievacation.vercel.app/projects/project-id/requests/request-id'
  );
});
