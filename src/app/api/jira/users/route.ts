import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthedProfile } from '@/lib/jira/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthedProfile();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!auth.profile.is_system_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = createServiceClient() as any;
  const { data, error } = await service
    .from('users')
    .select('id, name, email')
    .order('email', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data || [] });
}
