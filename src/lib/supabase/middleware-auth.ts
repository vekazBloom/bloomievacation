import type { NextRequest } from 'next/server';

export function isAuthPage(pathname: string) {
  return pathname.startsWith('/login') || pathname.startsWith('/signup');
}

export function isPublicPath(pathname: string) {
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/invite') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/'
  );
}

export function hasSupabaseAuthCookie(request: Pick<NextRequest, 'cookies'>) {
  return request.cookies.getAll().some((cookie) => {
    return cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token');
  });
}

export function isRscRequest(request: Pick<NextRequest, 'headers'>) {
  return (
    request.headers.get('Rsc') === '1' ||
    request.headers.get('Next-Router-Prefetch') === '1'
  );
}

export function shouldRefreshSessionInMiddleware(
  request: Pick<NextRequest, 'headers' | 'cookies'>,
  pathname: string
) {
  if (isPublicPath(pathname)) {
    return isAuthPage(pathname) && hasSupabaseAuthCookie(request);
  }

  return false;
}
