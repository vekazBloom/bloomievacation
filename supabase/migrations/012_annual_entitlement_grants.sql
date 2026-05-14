-- Annual entitlement grants (per user, per project "vintage") + allocations per leave request.
-- See docs/ANNUAL_ENTITLEMENTS.md for policy semantics.

CREATE TABLE public.annual_entitlement_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  grant_year INT,
  label TEXT NOT NULL DEFAULT '',
  days_allocated NUMERIC(5,1) NOT NULL CHECK (days_allocated >= 0),
  valid_from DATE NOT NULL,
  valid_to DATE,
  source TEXT NOT NULL DEFAULT 'grant'
    CHECK (source IN ('grant', 'carryover', 'legacy_migration')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_annual_grants_project_user ON public.annual_entitlement_grants(project_id, user_id);
CREATE INDEX idx_annual_grants_valid ON public.annual_entitlement_grants(project_id, user_id, valid_from, valid_to);

CREATE UNIQUE INDEX annual_grants_one_legacy_per_member
  ON public.annual_entitlement_grants(project_id, user_id)
  WHERE source = 'legacy_migration';

CREATE TABLE public.leave_request_grant_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id UUID NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  grant_id UUID NOT NULL REFERENCES public.annual_entitlement_grants(id) ON DELETE RESTRICT,
  working_days NUMERIC(5,1) NOT NULL CHECK (working_days > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(leave_request_id, grant_id)
);

CREATE INDEX idx_leave_grant_alloc_request ON public.leave_request_grant_allocations(leave_request_id);
CREATE INDEX idx_leave_grant_alloc_grant ON public.leave_request_grant_allocations(grant_id);

-- Policy knobs (defaults preserve previous behaviour: accrual Jan 1, no statutory first-period expiry)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS annual_accrual_month INT NOT NULL DEFAULT 1
    CHECK (annual_accrual_month BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS annual_accrual_day INT NOT NULL DEFAULT 1
    CHECK (annual_accrual_day BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS annual_first_use_by_month INT
    CHECK (annual_first_use_by_month IS NULL OR annual_first_use_by_month BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS annual_first_use_by_day INT
    CHECK (annual_first_use_by_day IS NULL OR annual_first_use_by_day BETWEEN 1 AND 31);

CREATE TRIGGER set_annual_grants_updated_at
  BEFORE UPDATE ON public.annual_entitlement_grants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.annual_entitlement_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_request_grant_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "annual_grants_select_project"
  ON public.annual_entitlement_grants FOR SELECT TO authenticated
  USING (
    public.is_system_admin(auth.uid())
    OR public.is_project_member(project_id, auth.uid())
  );

CREATE POLICY "annual_grants_insert_admin"
  ON public.annual_entitlement_grants FOR INSERT TO authenticated
  WITH CHECK (
    public.is_system_admin(auth.uid())
    OR public.is_project_admin(project_id, auth.uid())
  );

CREATE POLICY "annual_grants_update_admin"
  ON public.annual_entitlement_grants FOR UPDATE TO authenticated
  USING (
    public.is_system_admin(auth.uid())
    OR public.is_project_admin(project_id, auth.uid())
  )
  WITH CHECK (
    public.is_system_admin(auth.uid())
    OR public.is_project_admin(project_id, auth.uid())
  );

CREATE POLICY "annual_grants_delete_admin"
  ON public.annual_entitlement_grants FOR DELETE TO authenticated
  USING (
    public.is_system_admin(auth.uid())
    OR public.is_project_admin(project_id, auth.uid())
  );

CREATE POLICY "leave_grant_alloc_select_project"
  ON public.leave_request_grant_allocations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.id = leave_request_grant_allocations.leave_request_id
        AND (
          public.is_system_admin(auth.uid())
          OR public.is_project_member(lr.project_id, auth.uid())
        )
    )
  );

CREATE POLICY "leave_grant_alloc_insert_owner_or_admin"
  ON public.leave_request_grant_allocations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.id = leave_request_grant_allocations.leave_request_id
        AND (
          public.is_system_admin(auth.uid())
          OR public.is_project_admin(lr.project_id, auth.uid())
          OR lr.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "leave_grant_alloc_update_owner_or_admin"
  ON public.leave_request_grant_allocations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.id = leave_request_grant_allocations.leave_request_id
        AND (
          public.is_system_admin(auth.uid())
          OR public.is_project_admin(lr.project_id, auth.uid())
          OR lr.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "leave_grant_alloc_delete_owner_or_admin"
  ON public.leave_request_grant_allocations FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.id = leave_request_grant_allocations.leave_request_id
        AND (
          public.is_system_admin(auth.uid())
          OR public.is_project_admin(lr.project_id, auth.uid())
          OR lr.user_id = auth.uid()
        )
    )
  );

-- Legacy grant per membership: mirrors current allowance pool
INSERT INTO public.annual_entitlement_grants (
  project_id,
  user_id,
  grant_year,
  label,
  days_allocated,
  valid_from,
  valid_to,
  source
)
SELECT
  pm.project_id,
  pm.user_id,
  NULL,
  'Legacy',
  (COALESCE(pm.annual_leave_total, 0) + COALESCE(pm.annual_leave_carried_over, 0))::NUMERIC,
  DATE '2000-01-01',
  NULL,
  'legacy_migration'
FROM public.project_members pm
WHERE NOT EXISTS (
  SELECT 1 FROM public.annual_entitlement_grants g
  WHERE g.project_id = pm.project_id
    AND g.user_id = pm.user_id
    AND g.source = 'legacy_migration'
);

-- Backfill allocations for existing annual requests (pending + approved)
INSERT INTO public.leave_request_grant_allocations (leave_request_id, grant_id, working_days)
SELECT lr.id, g.id, lr.working_days_count
FROM public.leave_requests lr
INNER JOIN public.annual_entitlement_grants g
  ON g.project_id = lr.project_id
 AND g.user_id = lr.user_id
 AND g.source = 'legacy_migration'
WHERE lr.type = 'annual'
  AND lr.status IN ('pending', 'approved')
ON CONFLICT (leave_request_id, grant_id) DO NOTHING;

-- New members: ensure a legacy entitlement row exists
CREATE OR REPLACE FUNCTION public.ensure_legacy_annual_grant_for_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.annual_entitlement_grants (
    project_id, user_id, grant_year, label, days_allocated, valid_from, valid_to, source
  )
  SELECT
    NEW.project_id,
    NEW.user_id,
    NULL,
    'Legacy',
    (COALESCE(NEW.annual_leave_total, 0) + COALESCE(NEW.annual_leave_carried_over, 0))::NUMERIC,
    DATE '2000-01-01',
    NULL,
    'legacy_migration'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.annual_entitlement_grants g
    WHERE g.project_id = NEW.project_id
      AND g.user_id = NEW.user_id
      AND g.source = 'legacy_migration'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_project_members_legacy_grant
  AFTER INSERT ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.ensure_legacy_annual_grant_for_member();

CREATE OR REPLACE FUNCTION public.sync_legacy_grant_days_allocated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.annual_entitlement_grants g
  SET
    days_allocated = (COALESCE(NEW.annual_leave_total, 0) + COALESCE(NEW.annual_leave_carried_over, 0))::NUMERIC,
    updated_at = NOW()
  WHERE g.project_id = NEW.project_id
    AND g.user_id = NEW.user_id
    AND g.source = 'legacy_migration';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_project_members_sync_legacy_grant
  AFTER UPDATE OF annual_leave_total, annual_leave_carried_over ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_grant_days_allocated();

