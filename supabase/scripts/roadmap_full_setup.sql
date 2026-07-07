-- Idempotent full setup for the Roadmap feature (migrations 031 + 032 + 033 combined).
-- Safe to run in the Supabase SQL editor of the Bloomivacation project (ref ditshwiwsfjtuyutawnf).
-- Re-runnable: enums are guarded, tables/columns/indexes use IF NOT EXISTS,
-- triggers/policies are dropped-then-created, seed rows use ON CONFLICT DO NOTHING.
-- Requires the existing helpers public.set_updated_at() and public.is_system_admin(uuid) (from migration 001).

-- ---------- enums ----------
DO $$ BEGIN
  CREATE TYPE public.roadmap_team_kind AS ENUM ('engineering', 'bt', 'future');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.roadmap_item_status AS ENUM ('completed', 'in_progress', 'planned', 'waiting');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- tables ----------
CREATE TABLE IF NOT EXISTS public.roadmap_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind public.roadmap_team_kind NOT NULL DEFAULT 'engineering',
  color TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.roadmap_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.roadmap_teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role_label TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.roadmap_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.roadmap_teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status public.roadmap_item_status NOT NULL DEFAULT 'planned',
  start_month DATE,
  end_month DATE,
  owner TEXT,
  dependencies TEXT,
  notes TEXT,
  color TEXT,
  depends_on_id UUID REFERENCES public.roadmap_items(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT roadmap_items_month_span CHECK (
    (start_month IS NULL) = (end_month IS NULL)
    AND (end_month IS NULL OR end_month >= start_month)
  )
);

-- columns for pre-existing installs (migrations 033, 034)
ALTER TABLE public.roadmap_items ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE public.roadmap_items
  ADD COLUMN IF NOT EXISTS depends_on_id UUID REFERENCES public.roadmap_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_roadmap_team_members_team ON public.roadmap_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_items_team ON public.roadmap_items(team_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_items_start_month ON public.roadmap_items(start_month);

-- ---------- triggers ----------
DROP TRIGGER IF EXISTS set_roadmap_teams_updated_at ON public.roadmap_teams;
CREATE TRIGGER set_roadmap_teams_updated_at
  BEFORE UPDATE ON public.roadmap_teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_roadmap_team_members_updated_at ON public.roadmap_team_members;
CREATE TRIGGER set_roadmap_team_members_updated_at
  BEFORE UPDATE ON public.roadmap_team_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_roadmap_items_updated_at ON public.roadmap_items;
CREATE TRIGGER set_roadmap_items_updated_at
  BEFORE UPDATE ON public.roadmap_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- row level security (system admins only) ----------
ALTER TABLE public.roadmap_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roadmap_teams_admin_all" ON public.roadmap_teams;
CREATE POLICY "roadmap_teams_admin_all"
  ON public.roadmap_teams FOR ALL TO authenticated
  USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "roadmap_team_members_admin_all" ON public.roadmap_team_members;
CREATE POLICY "roadmap_team_members_admin_all"
  ON public.roadmap_team_members FOR ALL TO authenticated
  USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "roadmap_items_admin_all" ON public.roadmap_items;
CREATE POLICY "roadmap_items_admin_all"
  ON public.roadmap_items FOR ALL TO authenticated
  USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

-- ---------- seed: teams ----------
INSERT INTO public.roadmap_teams (id, name, kind, color, sort_order) VALUES
  ('00000000-0000-0000-0000-0000000ab101', 'Gerin',            'engineering', '#7F77DD', 1),
  ('00000000-0000-0000-0000-0000000ab102', 'Diligence Center', 'engineering', '#1D9E75', 2),
  ('00000000-0000-0000-0000-0000000ab103', 'Integrations',     'engineering', '#378ADD', 3),
  ('00000000-0000-0000-0000-0000000ab104', 'Mobile',           'engineering', '#D4537E', 4),
  ('00000000-0000-0000-0000-0000000ab105', 'Spend Cube',       'engineering', '#888780', 5),
  ('00000000-0000-0000-0000-0000000ab106', 'BT Team',          'bt',          '#B4B2A9', 6),
  ('00000000-0000-0000-0000-0000000ab107', 'Future Work',      'future',      '#5F5E5A', 7)
ON CONFLICT (id) DO NOTHING;

-- ---------- seed: members ----------
INSERT INTO public.roadmap_team_members (id, team_id, name, role_label, sort_order) VALUES
  ('00000000-0000-0000-0000-0000000ac201', '00000000-0000-0000-0000-0000000ab101', 'Armin Gerina',     'Lead',      1),
  ('00000000-0000-0000-0000-0000000ac202', '00000000-0000-0000-0000-0000000ab102', 'Benjamin Covčić',  'Developer', 1),
  ('00000000-0000-0000-0000-0000000ac203', '00000000-0000-0000-0000-0000000ab102', 'Sedin Hasić',      'Developer', 2),
  ('00000000-0000-0000-0000-0000000ac204', '00000000-0000-0000-0000-0000000ab103', 'Amar Burić',       'Developer', 1),
  ('00000000-0000-0000-0000-0000000ac205', '00000000-0000-0000-0000-0000000ab103', 'Omer Salkanović',  'Developer', 2),
  ('00000000-0000-0000-0000-0000000ac206', '00000000-0000-0000-0000-0000000ab104', 'Edis Banjić',      'Developer', 1),
  ('00000000-0000-0000-0000-0000000ac207', '00000000-0000-0000-0000-0000000ab104', 'Tarik Omerhodžić', 'Developer', 2),
  ('00000000-0000-0000-0000-0000000ac208', '00000000-0000-0000-0000-0000000ab104', 'Tarik Pajić',      'Designer',  3),
  ('00000000-0000-0000-0000-0000000ac209', '00000000-0000-0000-0000-0000000ab105', 'Edis Banjić',      'Developer', 1)
ON CONFLICT (id) DO NOTHING;

-- ---------- seed: items ----------
INSERT INTO public.roadmap_items
  (id, team_id, title, status, start_month, end_month, owner, dependencies, notes, sort_order)
VALUES
  ('00000000-0000-0000-0000-0000000ad301', '00000000-0000-0000-0000-0000000ab101', 'Internationalization', 'planned', NULL, NULL, 'Armin Gerina', NULL, NULL, 1),
  ('00000000-0000-0000-0000-0000000ad302', '00000000-0000-0000-0000-0000000ab101', 'GC Sales',             'planned', NULL, NULL, 'Armin Gerina', NULL, NULL, 2),
  ('00000000-0000-0000-0000-0000000ad311', '00000000-0000-0000-0000-0000000ab102', 'Diligence Center',  'planned', NULL, NULL, 'Benjamin Covčić & Sedin Hasić', NULL, NULL, 1),
  ('00000000-0000-0000-0000-0000000ad312', '00000000-0000-0000-0000-0000000ab102', 'Scope',             'planned', NULL, NULL, 'Benjamin Covčić & Sedin Hasić', NULL, NULL, 2),
  ('00000000-0000-0000-0000-0000000ad313', '00000000-0000-0000-0000-0000000ab102', 'Architecture',      'planned', NULL, NULL, 'Benjamin Covčić & Sedin Hasić', NULL, NULL, 3),
  ('00000000-0000-0000-0000-0000000ad314', '00000000-0000-0000-0000-0000000ab102', 'Development Plan',  'planned', NULL, NULL, 'Benjamin Covčić & Sedin Hasić', NULL, NULL, 4),
  ('00000000-0000-0000-0000-0000000ad321', '00000000-0000-0000-0000-0000000ab103', 'External API',      'planned', NULL, NULL, 'Amar Burić & Omer Salkanović', NULL, NULL, 1),
  ('00000000-0000-0000-0000-0000000ad322', '00000000-0000-0000-0000-0000000ab103', 'P2P Integrations',  'planned', NULL, NULL, 'Amar Burić & Omer Salkanović', NULL, NULL, 2),
  ('00000000-0000-0000-0000-0000000ad331', '00000000-0000-0000-0000-0000000ab104', 'Harvest Mobile',    'planned', NULL, NULL, 'Edis Banjić & Tarik Omerhodžić', NULL, NULL, 1),
  ('00000000-0000-0000-0000-0000000ad332', '00000000-0000-0000-0000-0000000ab104', 'Mobile App',        'planned', NULL, NULL, 'Edis Banjić & Tarik Omerhodžić', NULL, NULL, 2),
  ('00000000-0000-0000-0000-0000000ad333', '00000000-0000-0000-0000-0000000ab104', 'Mobile UI/UX',      'planned', NULL, NULL, 'Tarik Pajić', NULL, NULL, 3),
  ('00000000-0000-0000-0000-0000000ad341', '00000000-0000-0000-0000-0000000ab105', 'Spend Cube Beta Program', 'planned',     NULL, NULL, 'Edis Banjić', NULL, NULL, 1),
  ('00000000-0000-0000-0000-0000000ad342', '00000000-0000-0000-0000-0000000ab105', 'Harvest Chat',            'completed',   NULL, NULL, 'Edis Banjić', NULL, NULL, 2),
  ('00000000-0000-0000-0000-0000000ad343', '00000000-0000-0000-0000-0000000ab105', 'Terms Optimizer',         'completed',   NULL, NULL, 'Edis Banjić', NULL, NULL, 3),
  ('00000000-0000-0000-0000-0000000ad344', '00000000-0000-0000-0000-0000000ab105', 'MRO Spend Cube',          'completed',   NULL, NULL, 'Edis Banjić', NULL, NULL, 4),
  ('00000000-0000-0000-0000-0000000ad345', '00000000-0000-0000-0000-0000000ab105', 'Supplier Org Charts',     'completed',   NULL, NULL, 'Edis Banjić', NULL, NULL, 5),
  ('00000000-0000-0000-0000-0000000ad346', '00000000-0000-0000-0000-0000000ab105', 'Audio MIT',               'completed',   NULL, NULL, 'Edis Banjić', NULL, NULL, 6),
  ('00000000-0000-0000-0000-0000000ad347', '00000000-0000-0000-0000-0000000ab105', 'Harvest Bug Fixes',       'in_progress', NULL, NULL, 'Edis Banjić', NULL, NULL, 7),
  ('00000000-0000-0000-0000-0000000ad348', '00000000-0000-0000-0000-0000000ab105', 'Harvest / Harlee Audio Responses', 'waiting', NULL, NULL, 'Edis Banjić', 'Waiting for Bloomteq Confluence documentation', 'Waiting for Bloomteq Confluence documentation', 8),
  ('00000000-0000-0000-0000-0000000ad351', '00000000-0000-0000-0000-0000000ab106', 'Supplier Stability Index Documentation',  'planned', '2026-09-01', '2026-09-01', 'BT Team', NULL, NULL, 1),
  ('00000000-0000-0000-0000-0000000ad352', '00000000-0000-0000-0000-0000000ab106', 'GC Content Module Documentation',         'planned', '2026-09-01', '2026-09-01', 'BT Team', NULL, NULL, 2),
  ('00000000-0000-0000-0000-0000000ad353', '00000000-0000-0000-0000-0000000ab106', 'MIT Request Updates Documentation',       'planned', '2026-10-01', '2026-10-01', 'BT Team', NULL, NULL, 3),
  ('00000000-0000-0000-0000-0000000ad354', '00000000-0000-0000-0000-0000000ab106', 'MIT Bulk Download Documentation',         'planned', '2026-10-01', '2026-10-01', 'BT Team', NULL, NULL, 4),
  ('00000000-0000-0000-0000-0000000ad355', '00000000-0000-0000-0000-0000000ab106', 'Contract Performance Module Documentation', 'planned', '2026-10-01', '2026-10-01', 'BT Team', NULL, NULL, 5),
  ('00000000-0000-0000-0000-0000000ad356', '00000000-0000-0000-0000-0000000ab106', 'UI Overhaul Documentation',               'planned', '2026-11-01', '2026-11-01', 'BT Team', NULL, NULL, 6),
  ('00000000-0000-0000-0000-0000000ad357', '00000000-0000-0000-0000-0000000ab106', 'Redesign Documentation & Design Support', 'planned', '2026-11-01', '2026-11-01', 'BT Team', NULL, NULL, 7),
  ('00000000-0000-0000-0000-0000000ad361', '00000000-0000-0000-0000-0000000ab107', 'Forensic Sales New Application', 'planned', NULL, NULL, NULL, NULL, NULL, 1)
ON CONFLICT (id) DO NOTHING;
