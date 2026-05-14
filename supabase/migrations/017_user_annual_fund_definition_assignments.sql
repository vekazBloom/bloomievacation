-- Global (cross-project) template assignments per user. Legacy grant definition_id stays the "primary"
-- template (first by sort_order, label) and is synced from this set via API.

CREATE TABLE public.user_annual_fund_definition_assignments (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  definition_id UUID NOT NULL REFERENCES public.annual_fund_definitions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, definition_id)
);

CREATE INDEX idx_user_annual_fund_assign_definition ON public.user_annual_fund_definition_assignments(definition_id);

ALTER TABLE public.user_annual_fund_definition_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_annual_fund_assign_select"
  ON public.user_annual_fund_definition_assignments FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_system_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.project_members me
      INNER JOIN public.project_members them
        ON me.project_id = them.project_id
       AND them.user_id = user_annual_fund_definition_assignments.user_id
      WHERE me.user_id = (SELECT auth.uid())
    )
  );

INSERT INTO public.user_annual_fund_definition_assignments (user_id, definition_id)
SELECT DISTINCT g.user_id, g.definition_id
FROM public.annual_entitlement_grants g
WHERE g.source = 'legacy_migration'
  AND g.definition_id IS NOT NULL
ON CONFLICT (user_id, definition_id) DO NOTHING;
