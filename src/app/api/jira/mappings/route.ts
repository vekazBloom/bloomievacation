import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthedProfile } from '@/lib/jira/service';

const schema = z.object({
  appUserId: z.string().uuid(),
  jiraAccountId: z.string().min(1),
  jiraDisplayName: z.string().optional(),
});

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthedProfile();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!auth.profile.is_system_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = createServiceClient() as any;
  const { data, error } = await service
    .from('jira_user_mappings')
    .select('id, app_user_id, app_user_email, jira_account_id, jira_display_name')
    .order('app_user_email', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ mappings: data || [] });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthedProfile();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!auth.profile.is_system_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const service = createServiceClient() as any;
  const { data: appUser } = await service
    .from('users')
    .select('id, email')
    .eq('id', parsed.data.appUserId)
    .maybeSingle();

  if (!appUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { error } = await service.from('jira_user_mappings').upsert(
    {
      app_user_id: appUser.id,
      app_user_email: appUser.email,
      jira_account_id: parsed.data.jiraAccountId,
      jira_display_name: parsed.data.jiraDisplayName ?? null,
      created_by: auth.user.id,
    },
    { onConflict: 'app_user_id' }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthedProfile();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!auth.profile.is_system_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const appUserId = new URL(request.url).searchParams.get('appUserId');
  if (!appUserId) return NextResponse.json({ error: 'appUserId is required' }, { status: 400 });

  const service = createServiceClient() as any;
  const { error } = await service.from('jira_user_mappings').delete().eq('app_user_id', appUserId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
