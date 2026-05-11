import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser, getUserProfile } from '@/lib/projects/access';
import type { ReligionCategory } from '@/types/database';

const schema = z.object({
  name: z.string().min(2),
  date: z.string(),
  category: z.enum([
    'islam',
    'christianity_catholic',
    'christianity_orthodox',
    'judaism',
    'hinduism',
    'buddhism',
    'other',
  ]),
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
    .from('religious_holidays_pool')
    .insert({
      ...parsed.data,
      category: parsed.data.category as ReligionCategory,
      created_by: user.id,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ holiday: data });
}
