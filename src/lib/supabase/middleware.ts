import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  hasSupabaseAuthCookie,
  isAuthPage,
  isPublicPath,
  shouldRefreshSessionInMiddleware,
} from '@/lib/supabase/middleware-auth';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('redirectTo', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const env = getSupabasePublicEnv();

  if (!env) {
    console.error(
      '[middleware] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
    return isPublicPath(pathname) ? response : redirectToLogin(request);
  }

  if (isPublicPath(pathname)) {
    if (!isAuthPage(pathname) || !hasSupabaseAuthCookie(request)) {
      return response;
    }
  } else if (!hasSupabaseAuthCookie(request)) {
    return redirectToLogin(request);
  } else if (!shouldRefreshSessionInMiddleware(request, pathname)) {
    return response;
  }

  try {
    const supabase = createServerClient(env.url, env.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && !isPublicPath(pathname)) {
      return redirectToLogin(request);
    }

    if (user && isAuthPage(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }

    return response;
  } catch (error) {
    console.error('[middleware] updateSession failed', error);
    return isPublicPath(pathname) ? NextResponse.next({ request }) : redirectToLogin(request);
  }
}
