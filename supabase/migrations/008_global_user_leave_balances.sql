-- ============================================================================
-- BloomieVacation - Global leave balances per user
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_leave_balances (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  annual_leave_total NUMERIC(5,1) DEFAULT 20 CHECK (annual_leave_total >= 0),
  annual_leave_used NUMERIC(5,1) DEFAULT 0 CHECK (annual_leave_used >= 0),
  annual_leave_carried_over NUMERIC(5,1) DEFAULT 0 CHECK (annual_leave_carried_over >= 0),
  sick_leave_total NUMERIC(5,1) DEFAULT 10 CHECK (sick_leave_total >= 0),
  sick_leave_used NUMERIC(5,1) DEFAULT 0 CHECK (sick_leave_used >= 0),
  religious_leave_total NUMERIC(5,1) DEFAULT 2 CHECK (religious_leave_total >= 0),
  religious_leave_used NUMERIC(5,1) DEFAULT 0 CHECK (religious_leave_used >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_user_leave_balances_updated_at ON public.user_leave_balances;
CREATE TRIGGER set_user_leave_balances_updated_at
  BEFORE UPDATE ON public.user_leave_balances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill totals from existing project membership settings, then compute used from approved requests.
INSERT INTO public.user_leave_balances (
  user_id,
  annual_leave_total,
  annual_leave_used,
  annual_leave_carried_over,
  sick_leave_total,
  sick_leave_used,
  religious_leave_total,
  religious_leave_used
)
SELECT
  u.id,
  COALESCE(MAX(pm.annual_leave_total), 20),
  COALESCE(SUM(CASE WHEN lr.status = 'approved' AND lr.type = 'annual' THEN lr.working_days_count ELSE 0 END), 0),
  COALESCE(MAX(pm.annual_leave_carried_over), 0),
  COALESCE(MAX(pm.sick_leave_total), 10),
  COALESCE(SUM(CASE WHEN lr.status = 'approved' AND lr.type = 'sick' THEN lr.working_days_count ELSE 0 END), 0),
  COALESCE(MAX(pm.religious_leave_total), 2),
  COALESCE(SUM(CASE WHEN lr.status = 'approved' AND lr.type = 'religious' THEN lr.working_days_count ELSE 0 END), 0)
FROM public.users u
LEFT JOIN public.project_members pm ON pm.user_id = u.id
LEFT JOIN public.leave_requests lr ON lr.user_id = u.id
GROUP BY u.id
ON CONFLICT (user_id) DO UPDATE
SET
  annual_leave_total = EXCLUDED.annual_leave_total,
  annual_leave_used = EXCLUDED.annual_leave_used,
  annual_leave_carried_over = EXCLUDED.annual_leave_carried_over,
  sick_leave_total = EXCLUDED.sick_leave_total,
  sick_leave_used = EXCLUDED.sick_leave_used,
  religious_leave_total = EXCLUDED.religious_leave_total,
  religious_leave_used = EXCLUDED.religious_leave_used;

CREATE OR REPLACE FUNCTION public.ensure_user_leave_balance(p_user_id UUID)
RETURNS VOID AS $$
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
$$ LANGUAGE plpgsql;

-- Update global used balance when leave requests change.
CREATE OR REPLACE FUNCTION public.sync_leave_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_delta NUMERIC := 0;
  v_user_id UUID;
  v_leave_type leave_type;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
    v_delta := NEW.working_days_count;
    v_user_id := NEW.user_id;
    v_leave_type := NEW.type;
  ELSIF TG_OP = 'UPDATE' THEN
    v_user_id := NEW.user_id;
    v_leave_type := NEW.type;

    IF OLD.status = 'approved' AND NEW.status != 'approved' THEN
      v_delta := -OLD.working_days_count;
      v_leave_type := OLD.type;
    ELSIF OLD.status != 'approved' AND NEW.status = 'approved' THEN
      v_delta := NEW.working_days_count;
    ELSIF OLD.status = 'approved' AND NEW.status = 'approved'
          AND OLD.working_days_count != NEW.working_days_count THEN
      v_delta := NEW.working_days_count - OLD.working_days_count;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'approved' THEN
    v_delta := -OLD.working_days_count;
    v_user_id := OLD.user_id;
    v_leave_type := OLD.type;
  END IF;

  IF v_delta != 0 AND v_user_id IS NOT NULL THEN
    PERFORM public.ensure_user_leave_balance(v_user_id);

    IF v_leave_type = 'annual' THEN
      UPDATE public.user_leave_balances
      SET annual_leave_used = GREATEST(0, annual_leave_used + v_delta)
      WHERE user_id = v_user_id;
    ELSIF v_leave_type = 'sick' THEN
      UPDATE public.user_leave_balances
      SET sick_leave_used = GREATEST(0, sick_leave_used + v_delta)
      WHERE user_id = v_user_id;
    ELSIF v_leave_type = 'religious' THEN
      UPDATE public.user_leave_balances
      SET religious_leave_used = GREATEST(0, religious_leave_used + v_delta)
      WHERE user_id = v_user_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_leave_balance_trigger ON public.leave_requests;
CREATE TRIGGER sync_leave_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.sync_leave_balance();

