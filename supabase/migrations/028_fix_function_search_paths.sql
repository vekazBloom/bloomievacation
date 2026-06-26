-- ============================================================================
-- BloomieVacation - #4: Fix mutable search_path on all public functions
--
-- Functions without a fixed SET search_path clause are vulnerable to
-- search_path injection: a malicious user could create objects in a schema
-- that shadows public ones and redirect function execution.
--
-- Fix: add SET search_path = public to every flagged function.
-- Functions that reference only built-ins use SET search_path = ''.
-- All table/type references in function bodies already use public. prefix
-- so locking the path is safe with no body changes required.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Trigger utility: stamp updated_at on any table
-- No public schema table references — empty search_path is safest.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ----------------------------------------------------------------------------
-- Trigger utility: stamp updated_at on jira tables (identical logic)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_jira_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ----------------------------------------------------------------------------
-- Pure text utility: no table references
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.slugify_text(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT trim(both '-' FROM regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g'));
$$;


-- ----------------------------------------------------------------------------
-- RLS helper functions (SECURITY DEFINER — must keep that attribute)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_project_admin(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = p_user_id AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_lead(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = p_user_id AND role IN ('admin', 'lead')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_system_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_system_admin FROM public.users WHERE id = p_user_id), FALSE);
$$;


-- ----------------------------------------------------------------------------
-- Working-days calculator: references public.national_holidays
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_working_days(
  p_start DATE,
  p_end   DATE
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_days    NUMERIC := 0;
  v_current DATE    := p_start;
  v_dow     INT;
  v_is_holiday BOOLEAN;
BEGIN
  WHILE v_current <= p_end LOOP
    v_dow := EXTRACT(DOW FROM v_current);
    IF v_dow != 0 AND v_dow != 6 THEN
      SELECT EXISTS(
        SELECT 1 FROM public.national_holidays nh
        WHERE (nh.is_recurring = TRUE
               AND EXTRACT(MONTH FROM nh.date) = EXTRACT(MONTH FROM v_current)
               AND EXTRACT(DAY   FROM nh.date) = EXTRACT(DAY   FROM v_current))
           OR (nh.is_recurring = FALSE AND nh.date = v_current)
      ) INTO v_is_holiday;

      IF NOT v_is_holiday THEN
        v_days := v_days + 1;
      END IF;
    END IF;
    v_current := v_current + INTERVAL '1 day';
  END LOOP;
  RETURN v_days;
END;
$$;


-- ----------------------------------------------------------------------------
-- Overlap checker: references public.projects, project_members, leave_requests
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_vacation_overlap(
  p_project_id        UUID,
  p_start             DATE,
  p_end               DATE,
  p_exclude_request_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_members       INT,
  overlapping_members INT,
  overlapping_user_ids UUID[],
  threshold_percent   INT
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_threshold INT;
  v_total     INT;
BEGIN
  SELECT vacation_threshold_percent INTO v_threshold
  FROM public.projects WHERE id = p_project_id;

  SELECT COUNT(*) INTO v_total
  FROM public.project_members WHERE project_id = p_project_id;

  RETURN QUERY
  SELECT
    v_total,
    (SELECT COUNT(DISTINCT lr.user_id)::INT
       FROM public.leave_requests lr
      WHERE lr.project_id = p_project_id
        AND lr.type = 'annual'
        AND lr.status = 'approved'
        AND lr.start_date <= p_end
        AND lr.end_date   >= p_start
        AND (p_exclude_request_id IS NULL OR lr.id != p_exclude_request_id)),
    ARRAY(
      SELECT DISTINCT lr.user_id
        FROM public.leave_requests lr
       WHERE lr.project_id = p_project_id
         AND lr.type = 'annual'
         AND lr.status = 'approved'
         AND lr.start_date <= p_end
         AND lr.end_date   >= p_start
         AND (p_exclude_request_id IS NULL OR lr.id != p_exclude_request_id)
    ),
    v_threshold;
END;
$$;


-- ----------------------------------------------------------------------------
-- Slug generator for new projects: references public.projects, slugify_text
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_project_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_slug      TEXT;
  candidate_slug TEXT;
  suffix         INT := 1;
BEGIN
  IF NEW.slug IS NOT NULL AND btrim(NEW.slug) <> '' THEN
    NEW.slug := public.slugify_text(NEW.slug);
  ELSE
    base_slug := public.slugify_text(NEW.name);
    IF base_slug = '' THEN
      base_slug := 'project';
    END IF;

    candidate_slug := base_slug;
    WHILE EXISTS (
      SELECT 1 FROM public.projects
       WHERE slug = candidate_slug
         AND id IS DISTINCT FROM NEW.id
    ) LOOP
      suffix         := suffix + 1;
      candidate_slug := base_slug || '-' || suffix;
    END LOOP;

    NEW.slug := candidate_slug;
  END IF;
  RETURN NEW;
END;
$$;


-- ----------------------------------------------------------------------------
-- Balance helpers (already have SET search_path = public in migration 009,
-- included here to guarantee the live DB is up to date)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_user_leave_balance(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_leave_balances (
    user_id,
    annual_leave_total,
    annual_leave_carried_over,
    sick_leave_total,
    religious_leave_total
  )
  SELECT
    p_user_id,
    COALESCE(MAX(pm.annual_leave_total), 20),
    COALESCE(MAX(pm.annual_leave_carried_over), 0),
    COALESCE(MAX(pm.sick_leave_total), 10),
    COALESCE(MAX(pm.religious_leave_total), 2)
  FROM public.project_members pm
  WHERE pm.user_id = p_user_id
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;
