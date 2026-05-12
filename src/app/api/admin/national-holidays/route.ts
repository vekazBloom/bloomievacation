import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { NATIONAL_HOLIDAYS_CACHE_TAG } from '@/lib/holidays/national';
import { getCurrentUser, getUserProfile } from '@/lib/projects/access';

const schema = z.object({
  name: z.string().min(2),
  date: z.string(),
  is_recurring: z.boolean().default(true),
  description: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const profile = await getUserProfile(user.id);
  if (!profile?.is_system_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { data, error } = await supabase
    .from('national_holidays')
    .insert({ ...parsed.data, created_by: user.id })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidateTag(NATIONAL_HOLIDAYS_CACHE_TAG);
  return NextResponse.json({ holiday: data });
}
