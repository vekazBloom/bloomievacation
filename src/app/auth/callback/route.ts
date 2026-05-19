import { NextResponse } from 'next/server';
import { sanitizeInternalRedirectPath } from '@/lib/security/redirect';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Handles Supabase email confirmation / magic-link redirects (PKCE code exchange).
 * Configure this URL in Supabase → Authentication → URL configuration → Redirect URLs.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = sanitizeInternalRedirectPath(url.searchParams.get('next'));
  const origin = url.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing-code`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth/callback] exchangeCodeForSession failed', error.message);
    return NextResponse.redirect(`${origin}/login?error=auth-callback`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
