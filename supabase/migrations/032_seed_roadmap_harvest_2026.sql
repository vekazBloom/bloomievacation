-- Seed: Harvest 2026 roadmap content.
-- Engineering responsibilities have no stated month in the source, so they are seeded
-- UNSCHEDULED (start_month/end_month NULL) for the admin to place on the timeline.
-- Only BT items and Spend Cube "current status" items carry the source-stated month/status.

INSERT INTO public.roadmap_items
  (id, team_id, title, status, start_month, end_month, owner, dependencies, notes, sort_order)
VALUES
  -- Gerin (unscheduled, planned)
  ('00000000-0000-0000-0000-0000000ad301', '00000000-0000-0000-0000-0000000ab101', 'Internationalization', 'planned', NULL, NULL, 'Armin Gerina', NULL, NULL, 1),
  ('00000000-0000-0000-0000-0000000ad302', '00000000-0000-0000-0000-0000000ab101', 'GC Sales',             'planned', NULL, NULL, 'Armin Gerina', NULL, NULL, 2),

  -- Diligence Center (unscheduled, planned)
  ('00000000-0000-0000-0000-0000000ad311', '00000000-0000-0000-0000-0000000ab102', 'Diligence Center',  'planned', NULL, NULL, 'Benjamin Covčić & Sedin Hasić', NULL, NULL, 1),
  ('00000000-0000-0000-0000-0000000ad312', '00000000-0000-0000-0000-0000000ab102', 'Scope',             'planned', NULL, NULL, 'Benjamin Covčić & Sedin Hasić', NULL, NULL, 2),
  ('00000000-0000-0000-0000-0000000ad313', '00000000-0000-0000-0000-0000000ab102', 'Architecture',      'planned', NULL, NULL, 'Benjamin Covčić & Sedin Hasić', NULL, NULL, 3),
  ('00000000-0000-0000-0000-0000000ad314', '00000000-0000-0000-0000-0000000ab102', 'Development Plan',  'planned', NULL, NULL, 'Benjamin Covčić & Sedin Hasić', NULL, NULL, 4),

  -- Integrations (unscheduled, planned)
  ('00000000-0000-0000-0000-0000000ad321', '00000000-0000-0000-0000-0000000ab103', 'External API',      'planned', NULL, NULL, 'Amar Burić & Omer Salkanović', NULL, NULL, 1),
  ('00000000-0000-0000-0000-0000000ad322', '00000000-0000-0000-0000-0000000ab103', 'P2P Integrations',  'planned', NULL, NULL, 'Amar Burić & Omer Salkanović', NULL, NULL, 2),

  -- Mobile (unscheduled, planned)
  ('00000000-0000-0000-0000-0000000ad331', '00000000-0000-0000-0000-0000000ab104', 'Harvest Mobile',    'planned', NULL, NULL, 'Edis Banjić & Tarik Omerhodžić', NULL, NULL, 1),
  ('00000000-0000-0000-0000-0000000ad332', '00000000-0000-0000-0000-0000000ab104', 'Mobile App',        'planned', NULL, NULL, 'Edis Banjić & Tarik Omerhodžić', NULL, NULL, 2),
  ('00000000-0000-0000-0000-0000000ad333', '00000000-0000-0000-0000-0000000ab104', 'Mobile UI/UX',      'planned', NULL, NULL, 'Tarik Pajić', NULL, NULL, 3),

  -- Spend Cube — beta program (unscheduled) + current status snapshot
  ('00000000-0000-0000-0000-0000000ad341', '00000000-0000-0000-0000-0000000ab105', 'Spend Cube Beta Program', 'planned',     NULL, NULL, 'Edis Banjić', NULL, NULL, 1),
  ('00000000-0000-0000-0000-0000000ad342', '00000000-0000-0000-0000-0000000ab105', 'Harvest Chat',            'completed',   NULL, NULL, 'Edis Banjić', NULL, NULL, 2),
  ('00000000-0000-0000-0000-0000000ad343', '00000000-0000-0000-0000-0000000ab105', 'Terms Optimizer',         'completed',   NULL, NULL, 'Edis Banjić', NULL, NULL, 3),
  ('00000000-0000-0000-0000-0000000ad344', '00000000-0000-0000-0000-0000000ab105', 'MRO Spend Cube',          'completed',   NULL, NULL, 'Edis Banjić', NULL, NULL, 4),
  ('00000000-0000-0000-0000-0000000ad345', '00000000-0000-0000-0000-0000000ab105', 'Supplier Org Charts',     'completed',   NULL, NULL, 'Edis Banjić', NULL, NULL, 5),
  ('00000000-0000-0000-0000-0000000ad346', '00000000-0000-0000-0000-0000000ab105', 'Audio MIT',               'completed',   NULL, NULL, 'Edis Banjić', NULL, NULL, 6),
  ('00000000-0000-0000-0000-0000000ad347', '00000000-0000-0000-0000-0000000ab105', 'Harvest Bug Fixes',       'in_progress', NULL, NULL, 'Edis Banjić', NULL, NULL, 7),
  ('00000000-0000-0000-0000-0000000ad348', '00000000-0000-0000-0000-0000000ab105', 'Harvest / Harlee Audio Responses', 'waiting', NULL, NULL, 'Edis Banjić', 'Waiting for Bloomteq Confluence documentation', 'Waiting for Bloomteq Confluence documentation', 8),

  -- BT Team (planned, single-month spans; only the 7 non-duplicate documentation items)
  ('00000000-0000-0000-0000-0000000ad351', '00000000-0000-0000-0000-0000000ab106', 'Supplier Stability Index Documentation',  'planned', '2026-09-01', '2026-09-01', 'BT Team', NULL, NULL, 1),
  ('00000000-0000-0000-0000-0000000ad352', '00000000-0000-0000-0000-0000000ab106', 'GC Content Module Documentation',         'planned', '2026-09-01', '2026-09-01', 'BT Team', NULL, NULL, 2),
  ('00000000-0000-0000-0000-0000000ad353', '00000000-0000-0000-0000-0000000ab106', 'MIT Request Updates Documentation',       'planned', '2026-10-01', '2026-10-01', 'BT Team', NULL, NULL, 3),
  ('00000000-0000-0000-0000-0000000ad354', '00000000-0000-0000-0000-0000000ab106', 'MIT Bulk Download Documentation',         'planned', '2026-10-01', '2026-10-01', 'BT Team', NULL, NULL, 4),
  ('00000000-0000-0000-0000-0000000ad355', '00000000-0000-0000-0000-0000000ab106', 'Contract Performance Module Documentation', 'planned', '2026-10-01', '2026-10-01', 'BT Team', NULL, NULL, 5),
  ('00000000-0000-0000-0000-0000000ad356', '00000000-0000-0000-0000-0000000ab106', 'UI Overhaul Documentation',               'planned', '2026-11-01', '2026-11-01', 'BT Team', NULL, NULL, 6),
  ('00000000-0000-0000-0000-0000000ad357', '00000000-0000-0000-0000-0000000ab106', 'Redesign Documentation & Design Support', 'planned', '2026-11-01', '2026-11-01', 'BT Team', NULL, NULL, 7),

  -- Future Work
  ('00000000-0000-0000-0000-0000000ad361', '00000000-0000-0000-0000-0000000ab107', 'Forensic Sales New Application', 'planned', NULL, NULL, NULL, NULL, NULL, 1)
ON CONFLICT (id) DO NOTHING;
