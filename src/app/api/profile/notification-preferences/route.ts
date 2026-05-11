import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/projects/access';

const schema = z.object({
  emailNotificationsEnabled: z.boolean(),
});

export async function GET() {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('users')
    .select('email_notifications_enabled')
    .eq('id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    emailNotificationsEnabled: data?.email_notifications_enabled !== false,
  });
}

export async function PATCH(request: NextRequest) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { error } = await supabase
    .from('users')
    .update({ email_notifications_enabled: parsed.data.emailNotificationsEnabled })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ emailNotificationsEnabled: parsed.data.emailNotificationsEnabled });
}
