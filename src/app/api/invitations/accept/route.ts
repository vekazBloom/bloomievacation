import { NextRequest, NextResponse } from 'next/server';
import { acceptInvitationToken } from '@/lib/invitations/accept';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function acceptInvite(token: string) {
  const supabase = createClient();
  const service = createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { ok: false as const, status: 401, error: 'Not authenticated' };
  }

  const result = await acceptInvitationToken(service, token, {
    id: user.id,
    email: user.email,
    name: (user.user_metadata?.name as string) || null,
  });

  if (!result.ok) {
    return result;
  }

  return { ok: true as const, projectId: result.projectId };
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const redirectPath = request.nextUrl.searchParams.get('redirect') || '/dashboard';
  if (!token) return NextResponse.redirect(new URL('/?error=no-token', request.url));

  const result = await acceptInvite(token);
  if (!result.ok) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(result.error || 'invite-failed')}`, request.url)
    );
  }

  return NextResponse.redirect(new URL(redirectPath, request.url));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token = body?.token;
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  const result = await acceptInvite(token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, projectId: result.projectId });
}
