-- ============================================================================
-- BloomieVacation - Seed Data
-- ============================================================================
-- Run AFTER 001_initial_schema.sql
-- Run AFTER you create the auth user via Supabase Dashboard:
--   email: vekaz.hadzic@bloomteq.com
--   password: Bloomteq2025!
--   auto-confirm: yes
-- ============================================================================

-- ============================================================================
-- SYSTEM ADMIN USER
-- ============================================================================
-- Insert/update the system admin user, linking to the existing auth user.

INSERT INTO public.users (id, email, name, is_system_admin)
SELECT
  au.id,
  'vekaz.hadzic@bloomteq.com',
  'Vekaz Hadzic',
  TRUE
FROM auth.users au
WHERE au.email = 'vekaz.hadzic@bloomteq.com'
ON CONFLICT (id) DO UPDATE SET
  is_system_admin = TRUE,
  name = EXCLUDED.name;

-- ============================================================================
-- BOSNIAN NATIONAL HOLIDAYS (recurring)
-- ============================================================================

INSERT INTO public.national_holidays (name, date, is_recurring, description) VALUES
  ('New Year''s Day',          '2025-01-01', TRUE, 'Nova godina'),
  ('New Year''s Day (2nd)',    '2025-01-02', TRUE, 'Nova godina (drugi dan)'),
  ('Orthodox Christmas',       '2025-01-07', TRUE, 'Pravoslavni Božić'),
  ('Independence Day',         '2025-03-01', TRUE, 'Dan nezavisnosti BiH'),
  ('Labour Day',               '2025-05-01', TRUE, 'Praznik rada'),
  ('Labour Day (2nd)',         '2025-05-02', TRUE, 'Praznik rada (drugi dan)'),
  ('Statehood Day',            '2025-11-25', TRUE, 'Dan državnosti BiH'),
  ('Catholic Christmas',       '2025-12-25', TRUE, 'Katolički Božić')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- RELIGIOUS HOLIDAYS POOL
-- ============================================================================
-- Note: Islamic and some Christian/Jewish holidays are lunar/movable.
-- Using 2025 dates as reference. Admin can update each year via UI.

-- ISLAM
INSERT INTO public.religious_holidays_pool (name, date, category, description, is_recurring) VALUES
  ('Eid al-Fitr (Day 1)',      '2025-03-30', 'islam', 'Ramazanski Bajram - prvi dan', FALSE),
  ('Eid al-Fitr (Day 2)',      '2025-03-31', 'islam', 'Ramazanski Bajram - drugi dan', FALSE),
  ('Eid al-Adha (Day 1)',      '2025-06-06', 'islam', 'Kurban Bajram - prvi dan', FALSE),
  ('Eid al-Adha (Day 2)',      '2025-06-07', 'islam', 'Kurban Bajram - drugi dan', FALSE),
  ('Mawlid al-Nabi',           '2025-09-04', 'islam', 'Mevlud', FALSE)
ON CONFLICT DO NOTHING;

-- CHRISTIANITY (CATHOLIC)
INSERT INTO public.religious_holidays_pool (name, date, category, description, is_recurring) VALUES
  ('Catholic Easter',          '2025-04-20', 'christianity_catholic', 'Katolički Uskrs', FALSE),
  ('Catholic Easter Monday',   '2025-04-21', 'christianity_catholic', 'Uskrsni ponedjeljak', FALSE),
  ('All Saints'' Day',         '2025-11-01', 'christianity_catholic', 'Svi sveti', TRUE),
  ('Catholic Christmas Eve',   '2025-12-24', 'christianity_catholic', 'Badnji dan', TRUE)
ON CONFLICT DO NOTHING;

-- CHRISTIANITY (ORTHODOX)
INSERT INTO public.religious_holidays_pool (name, date, category, description, is_recurring) VALUES
  ('Orthodox Christmas Eve',   '2025-01-06', 'christianity_orthodox', 'Pravoslavni Badnji dan', TRUE),
  ('Orthodox Easter',          '2025-04-20', 'christianity_orthodox', 'Pravoslavni Uskrs', FALSE),
  ('Orthodox Easter Monday',   '2025-04-21', 'christianity_orthodox', 'Pravoslavni Uskrsni ponedjeljak', FALSE),
  ('St. Sava Day',             '2025-01-27', 'christianity_orthodox', 'Sveti Sava', TRUE)
ON CONFLICT DO NOTHING;

-- JUDAISM
INSERT INTO public.religious_holidays_pool (name, date, category, description, is_recurring) VALUES
  ('Passover',                 '2025-04-13', 'judaism', 'Pesah', FALSE),
  ('Yom Kippur',               '2025-10-02', 'judaism', 'Dan pomirenja', FALSE),
  ('Rosh Hashanah',            '2025-09-23', 'judaism', 'Jevrejska Nova godina', FALSE),
  ('Hanukkah (Day 1)',         '2025-12-15', 'judaism', 'Hanuka', FALSE)
ON CONFLICT DO NOTHING;

-- HINDUISM
INSERT INTO public.religious_holidays_pool (name, date, category, description, is_recurring) VALUES
  ('Diwali',                   '2025-10-21', 'hinduism', 'Festival svjetla', FALSE),
  ('Holi',                     '2025-03-14', 'hinduism', 'Festival boja', FALSE)
ON CONFLICT DO NOTHING;

-- BUDDHISM
INSERT INTO public.religious_holidays_pool (name, date, category, description, is_recurring) VALUES
  ('Vesak',                    '2025-05-12', 'buddhism', 'Dan Bude', FALSE)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- DONE
-- ============================================================================
-- You should now be able to log in with vekaz.hadzic@bloomteq.com / Bloomteq2025!
-- The user will be flagged as system admin and can create projects.
