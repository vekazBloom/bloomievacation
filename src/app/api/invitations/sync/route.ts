import { NextResponse } from 'next/server';
import { syncInvitationsForUser } from '@/lib/invitations/status';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('name')
    .eq('id', user.id)
    .maybeSingle();

  const { error } = await syncInvitationsForUser(createServiceClient(), {
    id: user.id,
    email: user.email,
    name: (user.user_metadata?.name as string) || profile?.name || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
