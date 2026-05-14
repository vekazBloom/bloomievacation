-- Project-wide annual fund templates (name + validity). Members' legacy grants link via definition_id.

CREATE TABLE public.project_annual_fund_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  grant_year INT,
  valid_from DATE NOT NULL,
  valid_to DATE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_annual_fund_defs_project ON public.project_annual_fund_definitions(project_id);

ALTER TABLE public.annual_entitlement_grants
  ADD COLUMN IF NOT EXISTS definition_id UUID REFERENCES public.project_annual_fund_definitions(id) ON DELETE SET NULL;

CREATE TRIGGER set_project_annual_fund_defs_updated_at
  BEFORE UPDATE ON public.project_annual_fund_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.project_annual_fund_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_annual_fund_defs_select"
  ON public.project_annual_fund_definitions FOR SELECT TO authenticated
  USING (
    public.is_system_admin(auth.uid())
    OR public.is_project_member(project_id, auth.uid())
  );

CREATE POLICY "project_annual_fund_defs_insert_admin"
  ON public.project_annual_fund_definitions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_system_admin(auth.uid())
    OR public.is_project_admin(project_id, auth.uid())
  );

CREATE POLICY "project_annual_fund_defs_update_admin"
  ON public.project_annual_fund_definitions FOR UPDATE TO authenticated
  USING (
    public.is_system_admin(auth.uid())
    OR public.is_project_admin(project_id, auth.uid())
  )
  WITH CHECK (
    public.is_system_admin(auth.uid())
    OR public.is_project_admin(project_id, auth.uid())
  );

CREATE POLICY "project_annual_fund_defs_delete_admin"
  ON public.project_annual_fund_definitions FOR DELETE TO authenticated
  USING (
    public.is_system_admin(auth.uid())
    OR public.is_project_admin(project_id, auth.uid())
  );
