import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizePhoneNumber } from '@/lib/phone/normalize';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const schema = z.object({
  phoneNumber: z.string().nullable(),
});

function isMissingPhoneColumn(error: { message?: string; code?: string }) {
  const msg = (error.message ?? '').toLowerCase();
  return (
    error.code === '42703' ||
    (msg.includes('phone_number') && msg.includes('does not exist')) ||
    msg.includes("could not find the 'phone_number' column")
  );
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) return NextResponse.json({ error: authError.message }, { status: 401 });
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('users')
    .select('phone_number')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    if (isMissingPhoneColumn(error)) {
      return NextResponse.json({ phoneNumber: null });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ phoneNumber: data?.phone_number ?? null });
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) return NextResponse.json({ error: authError.message }, { status: 401 });
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const normalized =
    parsed.data.phoneNumber === null || parsed.data.phoneNumber === ''
      ? null
      : normalizePhoneNumber(parsed.data.phoneNumber);

  if (parsed.data.phoneNumber && !normalized) {
    return NextResponse.json(
      { error: 'Unesite ispravan broj telefona (npr. +387 61 123 456).' },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('users')
    .update({ phone_number: normalized })
    .eq('id', user.id);

  if (error) {
    if (isMissingPhoneColumn(error)) {
      return NextResponse.json(
        {
          error:
            'Baza nema kolonu phone_number. Pokrenite migraciju 029_telegram_bot_phone.sql u Supabase.',
        },
        { status: 503 }
      );
    }
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Ovaj broj telefona je već povezan s drugim korisnikom.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ phoneNumber: normalized });
}
