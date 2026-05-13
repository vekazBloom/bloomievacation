import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const schema = z.object({
  emailNotificationsEnabled: z.boolean(),
});

function isMissingEmailNotificationsColumn(error: { message?: string; code?: string }) {
  const msg = (error.message ?? '').toLowerCase();
  return (
    error.code === '42703' ||
    (msg.includes('email_notifications_enabled') && msg.includes('does not exist')) ||
    msg.includes("could not find the 'email_notifications_enabled' column")
  );
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 401 });
  }
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('users')
    .select('email_notifications_enabled')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    if (isMissingEmailNotificationsColumn(error)) {
      return NextResponse.json({ emailNotificationsEnabled: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    emailNotificationsEnabled: data?.email_notifications_enabled !== false,
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 401 });
  }
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { error } = await supabase
    .from('users')
    .update({ email_notifications_enabled: parsed.data.emailNotificationsEnabled })
    .eq('id', user.id);

  if (error) {
    if (isMissingEmailNotificationsColumn(error)) {
      return NextResponse.json(
        {
          error:
            'Database is missing email notification settings. Apply migration 002_email_prefs_and_sick_read.sql in Supabase.',
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ emailNotificationsEnabled: parsed.data.emailNotificationsEnabled });
}
