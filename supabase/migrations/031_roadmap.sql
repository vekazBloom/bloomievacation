-- Roadmap module: engineering-team swimlane timeline (self-contained, unrelated to projects).
-- System-admin only. Teams + members are seeded here; roadmap items are edited in-app.

CREATE TYPE public.roadmap_team_kind   AS ENUM ('engineering', 'bt', 'future');
CREATE TYPE public.roadmap_item_status AS ENUM ('completed', 'in_progress', 'planned', 'waiting');

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE public.roadmap_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind public.roadmap_team_kind NOT NULL DEFAULT 'engineering',
  color TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.roadmap_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.roadmap_teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role_label TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.roadmap_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.roadmap_teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status public.roadmap_item_status NOT NULL DEFAULT 'planned',
  start_month DATE,
  end_month DATE,
  owner TEXT,
  dependencies TEXT,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT roadmap_items_month_span CHECK (
    (start_month IS NULL) = (end_month IS NULL)
    AND (end_month IS NULL OR end_month >= start_month)
  )
);

CREATE INDEX idx_roadmap_team_members_team ON public.roadmap_team_members(team_id);
CREATE INDEX idx_roadmap_items_team ON public.roadmap_items(team_id);
CREATE INDEX idx_roadmap_items_start_month ON public.roadmap_items(start_month);

CREATE TRIGGER set_roadmap_teams_updated_at
  BEFORE UPDATE ON public.roadmap_teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_roadmap_team_members_updated_at
  BEFORE UPDATE ON public.roadmap_team_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_roadmap_items_updated_at
  BEFORE UPDATE ON public.roadmap_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY — system admins only (view + edit)
-- ============================================================================

ALTER TABLE public.roadmap_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roadmap_teams_admin_all"
  ON public.roadmap_teams FOR ALL TO authenticated
  USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "roadmap_team_members_admin_all"
  ON public.roadmap_team_members FOR ALL TO authenticated
  USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "roadmap_items_admin_all"
  ON public.roadmap_items FOR ALL TO authenticated
  USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

-- ============================================================================
-- SEED — teams + members (stable UUIDs so item seed can reference them)
-- ============================================================================

INSERT INTO public.roadmap_teams (id, name, kind, color, sort_order) VALUES
  ('00000000-0000-0000-0000-0000000ab101', 'Gerin',            'engineering', '#7F77DD', 1),
  ('00000000-0000-0000-0000-0000000ab102', 'Diligence Center', 'engineering', '#1D9E75', 2),
  ('00000000-0000-0000-0000-0000000ab103', 'Integrations',     'engineering', '#378ADD', 3),
  ('00000000-0000-0000-0000-0000000ab104', 'Mobile',           'engineering', '#D4537E', 4),
  ('00000000-0000-0000-0000-0000000ab105', 'Spend Cube',       'engineering', '#888780', 5),
  ('00000000-0000-0000-0000-0000000ab106', 'BT Team',          'bt',          '#B4B2A9', 6),
  ('00000000-0000-0000-0000-0000000ab107', 'Future Work',      'future',      '#5F5E5A', 7)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.roadmap_team_members (id, team_id, name, role_label, sort_order) VALUES
  ('00000000-0000-0000-0000-0000000ac201', '00000000-0000-0000-0000-0000000ab101', 'Armin Gerina',       'Lead',      1),
  ('00000000-0000-0000-0000-0000000ac202', '00000000-0000-0000-0000-0000000ab102', 'Benjamin Covčić',    'Developer', 1),
  ('00000000-0000-0000-0000-0000000ac203', '00000000-0000-0000-0000-0000000ab102', 'Sedin Hasić',        'Developer', 2),
  ('00000000-0000-0000-0000-0000000ac204', '00000000-0000-0000-0000-0000000ab103', 'Amar Burić',         'Developer', 1),
  ('00000000-0000-0000-0000-0000000ac205', '00000000-0000-0000-0000-0000000ab103', 'Omer Salkanović',    'Developer', 2),
  ('00000000-0000-0000-0000-0000000ac206', '00000000-0000-0000-0000-0000000ab104', 'Edis Banjić',        'Developer', 1),
  ('00000000-0000-0000-0000-0000000ac207', '00000000-0000-0000-0000-0000000ab104', 'Tarik Omerhodžić',   'Developer', 2),
  ('00000000-0000-0000-0000-0000000ac208', '00000000-0000-0000-0000-0000000ab104', 'Tarik Pajić',        'Designer',  3),
  ('00000000-0000-0000-0000-0000000ac209', '00000000-0000-0000-0000-0000000ab105', 'Edis Banjić',        'Developer', 1)
ON CONFLICT (id) DO NOTHING;
