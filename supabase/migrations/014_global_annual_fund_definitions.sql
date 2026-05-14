-- Global annual fund templates (shared across all projects). Replaces project_annual_fund_definitions.

CREATE TABLE public.annual_fund_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  grant_year INT,
  valid_from DATE NOT NULL,
  valid_to DATE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_annual_fund_definitions_sort ON public.annual_fund_definitions(sort_order, label);

CREATE TRIGGER set_annual_fund_definitions_updated_at
  BEFORE UPDATE ON public.annual_fund_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Drop FK from grants to old definitions table (name from 013)
ALTER TABLE public.annual_entitlement_grants
  DROP CONSTRAINT IF EXISTS annual_entitlement_grants_definition_id_fkey;

-- Copy distinct templates from project-scoped table when present
INSERT INTO public.annual_fund_definitions (label, grant_year, valid_from, valid_to, sort_order, created_at, updated_at)
SELECT
  label,
  grant_year,
  valid_from,
  valid_to,
  MIN(sort_order),
  MIN(created_at),
  MAX(updated_at)
FROM public.project_annual_fund_definitions
GROUP BY label, grant_year, valid_from, valid_to;

-- Point grants at new definition rows (match semantic key)
UPDATE public.annual_entitlement_grants g
SET definition_id = gn.id
FROM public.project_annual_fund_definitions po
JOIN public.annual_fund_definitions gn
  ON gn.label = po.label
 AND gn.grant_year IS NOT DISTINCT FROM po.grant_year
 AND gn.valid_from = po.valid_from
 AND gn.valid_to IS NOT DISTINCT FROM po.valid_to
WHERE g.definition_id = po.id;

DROP TABLE IF EXISTS public.project_annual_fund_definitions;

ALTER TABLE public.annual_entitlement_grants
  ADD CONSTRAINT annual_entitlement_grants_definition_id_fkey
  FOREIGN KEY (definition_id) REFERENCES public.annual_fund_definitions(id) ON DELETE SET NULL;

ALTER TABLE public.annual_fund_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "annual_fund_defs_select_auth"
  ON public.annual_fund_definitions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "annual_fund_defs_insert_admin"
  ON public.annual_fund_definitions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_system_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.user_id = auth.uid() AND pm.role = 'admin'
    )
  );

CREATE POLICY "annual_fund_defs_update_admin"
  ON public.annual_fund_definitions FOR UPDATE TO authenticated
  USING (
    public.is_system_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.user_id = auth.uid() AND pm.role = 'admin'
    )
  )
  WITH CHECK (
    public.is_system_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.user_id = auth.uid() AND pm.role = 'admin'
    )
  );

CREATE POLICY "annual_fund_defs_delete_admin"
  ON public.annual_fund_definitions FOR DELETE TO authenticated
  USING (
    public.is_system_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.user_id = auth.uid() AND pm.role = 'admin'
    )
  );
