import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { syncReligiousLeaveRequests } from '@/lib/religious/sync';
import { getCurrentUser } from '@/lib/projects/access';
import { createServiceClient } from '@/lib/supabase/server';

const schema = z.object({
  year: z.number().int(),
  name: z.string().min(2),
  date: z.string(),
  isRecurring: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const { user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { year, name, date, isRecurring = true } = parsed.data;
  const service = createServiceClient();

  const { data: holiday, error: holidayError } = await service
    .from('religious_holidays_pool')
    .insert({
      name,
      date,
      category: 'other',
      is_recurring: isRecurring,
      created_by: user.id,
    })
    .select('id, name, date, category, created_by, is_recurring')
    .single();

  if (holidayError) return NextResponse.json({ error: holidayError.message }, { status: 500 });

  const { error: selectionError } = await service.from('user_religious_selections').insert({
    user_id: user.id,
    religious_holiday_id: holiday.id,
    year,
  });

  if (selectionError) return NextResponse.json({ error: selectionError.message }, { status: 500 });

  const { data: selections } = await service
    .from('user_religious_selections')
    .select('religious_holiday_id')
    .eq('user_id', user.id)
    .eq('year', year);

  await syncReligiousLeaveRequests(
    service,
    user.id,
    year,
    (selections || []).map((selection) => selection.religious_holiday_id)
  );

  return NextResponse.json({ holiday });
}
