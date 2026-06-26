import { getNationalHolidays } from '@/lib/holidays/national';
import type { AppSupabase } from '@/lib/supabase/app-client';

export async function getNationalHolidaysList(_supabase: AppSupabase, _userId: string) {
  const holidays = await getNationalHolidays();
  return {
    ok: true as const,
    holidays: (holidays || []).map((h) => ({ id: h.id, name: h.name, date: h.date })),
  };
}

export async function getReligiousHolidayPool(supabase: AppSupabase, _userId: string) {
  const { data, error } = await supabase
    .from('religious_holidays_pool')
    .select('id, name, date, category, is_recurring')
    .order('date', { ascending: true });

  if (error) return { ok: false as const, error: error.message, status: 500 };

  return {
    ok: true as const,
    holidays: (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      date: row.date,
      category: row.category,
      isRecurring: row.is_recurring,
    })),
  };
}

export async function getMyReligiousSelections(
  supabase: AppSupabase,
  userId: string,
  year: number
) {
  const { data, error } = await supabase
    .from('user_religious_selections')
    .select('religious_holiday_id, religious_holidays_pool(id, name, date)')
    .eq('user_id', userId)
    .eq('year', year);

  if (error) return { ok: false as const, error: error.message, status: 500 };

  const selections = (data || []).map((row) => {
    const holiday = Array.isArray(row.religious_holidays_pool)
      ? row.religious_holidays_pool[0]
      : row.religious_holidays_pool;
    return {
      holidayId: row.religious_holiday_id,
      name: holiday?.name ?? 'Praznik',
      date: holiday?.date ?? '',
    };
  });

  return { ok: true as const, year, selections };
}
