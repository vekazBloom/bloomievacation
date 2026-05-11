import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { syncReligiousLeaveRequests } from '@/lib/religious/sync';
import { getCurrentUser } from '@/lib/projects/access';
import { createServiceClient } from '@/lib/supabase/server';

const schema = z.object({
  year: z.number().int(),
  holidayIds: z.array(z.string().uuid()),
});

export async function POST(request: NextRequest) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { year, holidayIds } = parsed.data;

  await supabase
    .from('user_religious_selections')
    .delete()
    .eq('user_id', user.id)
    .eq('year', year);

  if (holidayIds.length > 0) {
    const { error } = await supabase.from('user_religious_selections').insert(
      holidayIds.map((religiousHolidayId) => ({
        user_id: user.id,
        religious_holiday_id: religiousHolidayId,
        year,
      }))
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const service = createServiceClient();
  await syncReligiousLeaveRequests(service, user.id, year, holidayIds);

  return NextResponse.json({ ok: true });
}
