CREATE UNIQUE INDEX IF NOT EXISTS idx_national_holidays_name_date
  ON public.national_holidays (name, date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_religious_holidays_name_date_category
  ON public.religious_holidays_pool (name, date, category);
