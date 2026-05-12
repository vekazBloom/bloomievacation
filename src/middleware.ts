import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request);
  } catch (error) {
    console.error('[middleware] invocation failed', error);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    /*
     * Match page routes only:
     * - skip API handlers, Next internals, and static assets
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
