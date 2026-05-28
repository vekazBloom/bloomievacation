import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthedProfile } from '@/lib/jira/service';

const payloadSchema = z.object({
  siteUrl: z
    .string()
    .min(1)
    .transform((value) => {
      const trimmed = value.trim().replace(/\.$/, '');
      try {
        const parsed = new URL(trimmed);
        return `${parsed.protocol}//${parsed.host}`.replace(/\.$/, '');
      } catch {
        return trimmed;
      }
    })
    .refine((value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Invalid siteUrl'),
  projectKey: z.string().min(1).transform((value) => value.trim().toUpperCase()),
  boardId: z.number().int().positive(),
  jiraEmail: z.string().email().transform((value) => value.trim().toLowerCase()),
  jiraApiToken: z.string().min(10).transform((value) => value.trim()),
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
    .from('jira_connections')
    .select('site_url, project_key, board_id, jira_email')
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    config: data
      ? {
          siteUrl: data.site_url,
          projectKey: data.project_key,
          boardId: data.board_id,
          jiraEmail: data.jira_email,
        }
      : null,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthedProfile();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!auth.profile.is_system_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const service = createServiceClient() as any;
  const { data: existing } = await service.from('jira_connections').select('id').limit(1).maybeSingle();

  const payload = {
    site_url: parsed.data.siteUrl,
    project_key: parsed.data.projectKey,
    board_id: parsed.data.boardId,
    jira_email: parsed.data.jiraEmail,
    jira_api_token: parsed.data.jiraApiToken,
    created_by: auth.user.id,
  };

  const { error } = existing?.id
    ? await service.from('jira_connections').update(payload).eq('id', existing.id)
    : await service.from('jira_connections').insert(payload);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
