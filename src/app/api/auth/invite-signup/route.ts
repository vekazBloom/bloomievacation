import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { completeInviteSignup } from '@/lib/auth/invite-signup';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const schema = z.object({
  token: z.string().min(1),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  name: z.string().min(2),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid payload' },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const result = await completeInviteSignup(service, parsed.data);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, userId: result.userId });
}
