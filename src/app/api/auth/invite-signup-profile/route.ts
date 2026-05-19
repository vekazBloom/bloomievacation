import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const schema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(2),
});

/**
 * Creates public.users row after signUp when there is no session yet (email confirmation pending).
 * Uses service role so RLS does not block the insert.
 */
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { userId, email, name } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();
  const service = createServiceClient();

  const admin = service.auth.admin as {
    getUserById?: (id: string) => Promise<{
      data: { user: { id: string; email?: string } | null };
      error: unknown;
    }>;
  };

  if (typeof admin.getUserById !== 'function') {
    return NextResponse.json({ error: 'Auth admin API unavailable' }, { status: 503 });
  }

  const { data: authData, error: authErr } = await admin.getUserById(userId);
  if (authErr || !authData?.user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (authData.user.email?.trim().toLowerCase() !== normalizedEmail) {
    return NextResponse.json({ error: 'Email mismatch' }, { status: 403 });
  }

  const { error: profileErr } = await service.from('users').upsert(
    {
      id: userId,
      email: normalizedEmail,
      name: name.trim(),
    },
    { onConflict: 'id' }
  );

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
