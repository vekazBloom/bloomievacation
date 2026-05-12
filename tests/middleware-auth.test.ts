import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasSupabaseAuthCookie,
  isAuthPage,
  isPublicPath,
  isRscRequest,
  shouldRefreshSessionInMiddleware,
} from '../src/lib/supabase/middleware-auth';

function createRequest({
  pathname = '/dashboard',
  cookies = [] as Array<{ name: string; value: string }>,
  headers = {} as Record<string, string>,
} = {}) {
  return {
    cookies: {
      getAll() {
        return cookies;
      },
    },
    headers: {
      get(name: string) {
        return headers[name] ?? null;
      },
    },
    nextUrl: { pathname },
  };
}

test('isPublicPath treats invite and home as public', () => {
  assert.equal(isPublicPath('/'), true);
  assert.equal(isPublicPath('/invite'), true);
  assert.equal(isPublicPath('/dashboard'), false);
});

test('hasSupabaseAuthCookie detects Supabase auth cookies', () => {
  const request = createRequest({
    cookies: [{ name: 'sb-example-auth-token', value: 'token' }],
  });

  assert.equal(hasSupabaseAuthCookie(request), true);
  assert.equal(hasSupabaseAuthCookie(createRequest()), false);
});

test('shouldRefreshSessionInMiddleware skips RSC navigations on protected routes', () => {
  const request = createRequest({
    cookies: [{ name: 'sb-example-auth-token', value: 'token' }],
    headers: { Rsc: '1' },
  });

  assert.equal(isRscRequest(request), true);
  assert.equal(shouldRefreshSessionInMiddleware(request, '/dashboard'), false);
});

test('shouldRefreshSessionInMiddleware defers protected routes to server layout', () => {
  const request = createRequest({
    cookies: [{ name: 'sb-example-auth-token', value: 'token' }],
  });

  assert.equal(shouldRefreshSessionInMiddleware(request, '/dashboard'), false);
});

test('shouldRefreshSessionInMiddleware only checks auth pages when a session cookie exists', () => {
  assert.equal(shouldRefreshSessionInMiddleware(createRequest({ pathname: '/login' }), '/login'), false);
  assert.equal(
    shouldRefreshSessionInMiddleware(
      createRequest({
        pathname: '/login',
        cookies: [{ name: 'sb-example-auth-token', value: 'token' }],
      }),
      '/login'
    ),
    true
  );
  assert.equal(isAuthPage('/login'), true);
});
