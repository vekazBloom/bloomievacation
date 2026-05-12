import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';

export const NATIONAL_HOLIDAYS_CACHE_TAG = 'national-holidays';

type NationalHoliday = {
  id: string;
  name: string;
  date: string;
};

async function loadNationalHolidays(): Promise<NationalHoliday[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('national_holidays')
    .select('id, name, date')
    .order('date', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getNationalHolidays() {
  return unstable_cache(loadNationalHolidays, ['national-holidays'], {
    revalidate: 3600,
    tags: [NATIONAL_HOLIDAYS_CACHE_TAG],
  })();
}
